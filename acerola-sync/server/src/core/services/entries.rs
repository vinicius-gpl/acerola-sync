use chrono::{Datelike, NaiveDate, Utc};
use serde::Serialize;
use serde_json::{json, Map, Value};

use super::clock::today_in_brasilia;
use crate::{
    bios::state::AppState,
    data::{
        models::{
            entry::{Entry, EntryPatch, EntryWithMedia, STATUSES},
            media::Media,
            user::User,
        },
        repositories::{
            entries as entry_repository, media as media_repository, tracking as tracking_repository,
        },
    },
    infra::error::{AnilistError, AppError},
};

/// Resultado de uma escrita: a entrada como ficou e se ela ainda está pendente de envio.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedEntry {
    #[serde(flatten)]
    pub entry: EntryWithMedia,
    pub pending: bool,
}

/// Garante que a obra está no espelho. Se não estiver, busca no AniList (1 request).
pub async fn ensure_media(state: &AppState, user: &User, media_id: i64) -> Result<Media, AppError> {
    if let Some(media) = media_repository::find(&state.database_pool, media_id).await? {
        return Ok(media);
    }

    let token = state.anilist_token(user)?;
    let media = Media::from(state.anilist.media_by_id(Some(&token), media_id).await?);
    media_repository::upsert(&state.database_pool, &media).await?;
    Ok(media)
}

/// Obra com sinopse e banner. Busca o detalhe no AniList uma vez só por obra; se o AniList
/// estiver fora, devolve o que o espelho tem.
pub async fn ensure_details(
    state: &AppState, user: &User, media_id: i64,
) -> Result<Media, AppError> {
    let local = media_repository::find(&state.database_pool, media_id).await?;
    if let Some(media) = &local {
        if media.details_synced_at.is_some() {
            return Ok(media.clone());
        }
    }

    let token = state.anilist_token(user)?;
    match state.anilist.media_by_id(Some(&token), media_id).await {
        Ok(remote) => {
            media_repository::upsert(&state.database_pool, &Media::from(remote)).await?;
            media_repository::mark_details_synced(&state.database_pool, media_id).await?;
            media_repository::find(&state.database_pool, media_id)
                .await?
                .ok_or_else(|| AppError::NotFound("Media not found.".into()))
        },
        Err(error) if error.is_transient() && local.is_some() => {
            tracing::warn!("[Entries] Details unavailable, using mirror: {}", error);
            Ok(local.expect("checked above"))
        },
        Err(error) => Err(error.into()),
    }
}

/// Botão "sincronizar" da obra: manda o que estava pendente dela e puxa de novo a obra
/// inteira e a entrada do AniList (1 request, mais 1 se havia pendência).
pub async fn sync_one(
    state: &AppState, user: &User, media_id: i64,
) -> Result<(Media, Option<Entry>), AppError> {
    let local = entry_repository::find(&state.database_pool, user.id, media_id).await?;
    if let Some(pending) = local.clone().filter(|entry| entry.dirty) {
        let progress = pending.progress;
        let saved = save(state, user, pending, Some(progress), "MANUAL", None).await?;
        if saved.pending {
            // O AniList continua fora: não adianta puxar, e a pendência fica.
            let media = ensure_media(state, user, media_id).await?;
            return Ok((media, Some(saved.entry.entry)));
        }
    }

    let token = state.anilist_token(user)?;
    let mut remote = state.anilist.media_with_entry(&token, media_id).await?;
    let remote_entry = remote.media_list_entry.take();
    let media = Media::from(remote.clone());

    let mut transaction = state.database_pool.begin().await?;
    media_repository::upsert(&mut *transaction, &media).await?;
    let entry = match remote_entry {
        Some(viewer) => Some(
            entry_repository::upsert(
                &mut *transaction,
                &Entry::from_anilist(user.id, &viewer.with_media(remote)),
            )
            .await?,
        ),
        None => {
            // Saiu da lista no AniList (e não tinha nada pendente aqui): sai daqui também.
            entry_repository::delete(&mut *transaction, user.id, media_id).await?;
            None
        },
    };
    transaction.commit().await?;
    media_repository::mark_details_synced(&state.database_pool, media_id).await?;

    let media = media_repository::find(&state.database_pool, media_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Media not found.".into()))?;
    Ok((media, entry))
}

/// Aplica uma edição manual. Chegar no total marca como concluído, como no AniMouto.
pub fn apply_patch(
    current: &Entry, patch: &EntryPatch, total: Option<i32>, today: NaiveDate,
) -> Result<Entry, AppError> {
    let mut next = current.clone();

    if let Some(status) = &patch.status {
        if !STATUSES.contains(&status.as_str()) {
            return Err(AppError::BadRequest(format!("Unknown status '{status}'.")));
        }
        next.status = status.clone();
    }
    if let Some(progress) = patch.progress {
        if progress < 0 {
            return Err(AppError::BadRequest("Progress cannot be negative.".into()));
        }
        next.progress = match total {
            Some(total) if total > 0 => progress.min(total),
            _ => progress,
        };
    }
    if let Some(volumes) = patch.progress_volumes {
        next.progress_volumes = volumes.max(0);
    }
    if let Some(score) = patch.score {
        if !(0..=100).contains(&score) {
            return Err(AppError::BadRequest("Score must be between 0 and 100.".into()));
        }
        next.score = score;
    }
    if let Some(notes) = &patch.notes {
        next.notes = Some(notes.clone()).filter(|notes| !notes.is_empty());
    }
    if let Some(private) = patch.private {
        next.private = private;
    }
    if patch.started_at.is_some() {
        next.started_at = patch.started_at;
    }
    if patch.completed_at.is_some() {
        next.completed_at = patch.completed_at;
    }

    let progress_changed = next.progress != current.progress;
    if patch.status.is_none() && progress_changed {
        if total.is_some_and(|total| total > 0 && next.progress >= total) {
            next.status = "COMPLETED".into();
        } else if matches!(next.status.as_str(), "PLANNING" | "PAUSED" | "DROPPED") {
            next.status = "CURRENT".into();
        }
    }

    fill_dates(&mut next, today);
    Ok(next)
}

/// Datas que o AniList também preenche sozinho no site.
pub fn fill_dates(entry: &mut Entry, today: NaiveDate) {
    if matches!(entry.status.as_str(), "CURRENT" | "COMPLETED") && entry.started_at.is_none() {
        entry.started_at = Some(today);
    }
    if entry.status == "COMPLETED" && entry.completed_at.is_none() {
        entry.completed_at = Some(today);
    }
}

fn fuzzy(date: Option<NaiveDate>) -> Option<Value> {
    date.map(|date| json!({ "year": date.year(), "month": date.month(), "day": date.day() }))
}

/// Variáveis do `SaveMediaListEntry`. Campo vazio fica de fora: `null` explícito apagaria o
/// valor no AniList.
pub fn save_variables(entry: &Entry) -> Value {
    let mut variables = Map::new();
    variables.insert("mediaId".into(), json!(entry.media_id));
    variables.insert("status".into(), json!(entry.status));
    variables.insert("progress".into(), json!(entry.progress));
    variables.insert("progressVolumes".into(), json!(entry.progress_volumes));
    variables.insert("scoreRaw".into(), json!(entry.score));
    variables.insert("private".into(), json!(entry.private));
    if let Some(notes) = &entry.notes {
        variables.insert("notes".into(), json!(notes));
    }
    if let Some(started_at) = fuzzy(entry.started_at) {
        variables.insert("startedAt".into(), started_at);
    }
    if let Some(completed_at) = fuzzy(entry.completed_at) {
        variables.insert("completedAt".into(), completed_at);
    }
    Value::Object(variables)
}

/// Grava no AniList e no espelho ao mesmo tempo. Se o AniList estiver fora (rede, 5xx, rate
/// limit), grava só aqui com `dirty = true` e o worker reenvia depois.
pub async fn save(
    state: &AppState, user: &User, next: Entry, previous_progress: Option<i32>, source: &str,
    url: Option<&str>,
) -> Result<SavedEntry, AppError> {
    let token = state.anilist_token(user)?;

    let (saved, pending) = match state.anilist.save_entry(&token, save_variables(&next)).await {
        Ok(remote) => {
            let media = Media::from(remote.media.clone());
            let mut transaction = state.database_pool.begin().await?;
            media_repository::upsert(&mut *transaction, &media).await?;
            let saved =
                entry_repository::upsert(&mut *transaction, &Entry::from_anilist(user.id, &remote))
                    .await?;
            transaction.commit().await?;
            (saved, false)
        },
        Err(error) if error.is_transient() => {
            tracing::warn!(
                "[Entries] AniList unavailable, keeping {} as pending: {}",
                next.media_id,
                error
            );
            let pending = Entry {
                dirty: true,
                updated_at: Utc::now(),
                last_push_error: Some(error.to_string()),
                ..next
            };
            (entry_repository::upsert(&state.database_pool, &pending).await?, true)
        },
        Err(error) => return Err(error.into()),
    };

    let previous = previous_progress.unwrap_or(0);
    if saved.progress != previous {
        tracking_repository::insert_history(
            &state.database_pool,
            user.id,
            saved.media_id,
            saved.progress,
            previous,
            source,
            url,
        )
        .await?;
    }

    let mut with_media = entry_repository::attach_media(&state.database_pool, vec![saved]).await?;
    let entry = with_media.pop().ok_or_else(|| AppError::NotFound("Media not found.".into()))?;
    Ok(SavedEntry { entry, pending })
}

pub async fn update(
    state: &AppState, user: &User, media_id: i64, patch: &EntryPatch,
) -> Result<SavedEntry, AppError> {
    let media = ensure_media(state, user, media_id).await?;
    let current = entry_repository::find(&state.database_pool, user.id, media_id).await?;
    let base = current.clone().unwrap_or_else(|| Entry::blank(user.id, media_id));
    let next = apply_patch(&base, patch, media.total_units(), today_in_brasilia())?;

    save(state, user, next, current.map(|entry| entry.progress), "MANUAL", None).await
}

pub async fn delete(state: &AppState, user: &User, media_id: i64) -> Result<(), AppError> {
    let entry = entry_repository::find(&state.database_pool, user.id, media_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Entry not found.".into()))?;

    if let Some(entry_id) = entry.anilist_entry_id {
        let token = state.anilist_token(user)?;
        state.anilist.delete_entry(&token, entry_id).await?;
    }
    entry_repository::delete(&state.database_pool, user.id, media_id).await?;
    Ok(())
}

/// Reenvia ao AniList o que ficou pendente. Para no primeiro erro passageiro: se o AniList
/// caiu, não adianta tentar o resto agora.
pub async fn push_pending(state: &AppState, user: &User) -> Result<i32, AppError> {
    let pending = entry_repository::find_dirty(&state.database_pool, user.id).await?;
    if pending.is_empty() {
        return Ok(0);
    }

    let token = state.anilist_token(user)?;
    let mut pushed = 0;
    for entry in pending {
        match state.anilist.save_entry(&token, save_variables(&entry)).await {
            Ok(remote) => {
                let mut transaction = state.database_pool.begin().await?;
                media_repository::upsert(&mut *transaction, &Media::from(remote.media.clone()))
                    .await?;
                entry_repository::upsert(&mut *transaction, &Entry::from_anilist(user.id, &remote))
                    .await?;
                transaction.commit().await?;
                pushed += 1;
            },
            Err(error) => {
                entry_repository::mark_push_failed(
                    &state.database_pool,
                    user.id,
                    entry.media_id,
                    &error.to_string(),
                )
                .await?;
                if is_stop_error(&error) {
                    tracing::warn!("[Entries] Stopping pending push: {}", error);
                    break;
                }
            },
        }
    }
    Ok(pushed)
}

fn is_stop_error(error: &AnilistError) -> bool {
    error.is_transient() || matches!(error, AnilistError::Unauthorized)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(status: &str, progress: i32) -> Entry {
        Entry { status: status.into(), progress, ..Entry::blank(1, 10) }
    }

    fn day() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 11, 7).unwrap()
    }

    #[test]
    fn test_apply_patch_reaching_total_completes_and_fills_dates() {
        let patch = EntryPatch { progress: Some(12), ..Default::default() };
        let next = apply_patch(&entry("CURRENT", 11), &patch, Some(12), day()).unwrap();
        assert_eq!(next.status, "COMPLETED");
        assert_eq!(next.completed_at, Some(day()));
        assert_eq!(next.started_at, Some(day()));
    }

    #[test]
    fn test_apply_patch_progress_on_planning_starts_watching() {
        let patch = EntryPatch { progress: Some(1), ..Default::default() };
        let next = apply_patch(&entry("PLANNING", 0), &patch, None, day()).unwrap();
        assert_eq!(next.status, "CURRENT");
    }

    #[test]
    fn test_apply_patch_clamps_progress_to_total() {
        let patch = EntryPatch { progress: Some(30), ..Default::default() };
        let next = apply_patch(&entry("CURRENT", 1), &patch, Some(24), day()).unwrap();
        assert_eq!(next.progress, 24);
    }

    #[test]
    fn test_apply_patch_explicit_status_wins() {
        let patch =
            EntryPatch { progress: Some(12), status: Some("PAUSED".into()), ..Default::default() };
        let next = apply_patch(&entry("CURRENT", 1), &patch, Some(12), day()).unwrap();
        assert_eq!(next.status, "PAUSED");
    }

    #[test]
    fn test_apply_patch_rejects_invalid_values() {
        let bad_status = EntryPatch { status: Some("WATCHING".into()), ..Default::default() };
        assert!(apply_patch(&entry("CURRENT", 1), &bad_status, None, day()).is_err());

        let bad_score = EntryPatch { score: Some(101), ..Default::default() };
        assert!(apply_patch(&entry("CURRENT", 1), &bad_score, None, day()).is_err());
    }

    #[test]
    fn test_save_variables_omits_empty_fields() {
        let variables = save_variables(&entry("CURRENT", 3));
        assert_eq!(variables["progress"], 3);
        assert!(variables.get("notes").is_none());
        assert!(variables.get("startedAt").is_none());
    }
}
