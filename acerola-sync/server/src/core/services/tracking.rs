use serde::{Deserialize, Serialize};

use super::{
    clock::today_in_brasilia,
    entries::{self as entry_service, fill_dates, SavedEntry},
};
use crate::{
    bios::state::AppState,
    data::{
        models::{entry::Entry, media::Media, tracking::SiteMapping, user::User},
        repositories::{
            entries as entry_repository, media as media_repository, tracking as tracking_repository,
        },
    },
    infra::error::AppError,
};

/// Nota mínima do pg_trgm para aceitar um título do espelho sem perguntar ao AniList.
const LOCAL_MATCH_THRESHOLD: f32 = 0.75;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveInput {
    pub site: String,
    pub identifier: String,
    pub title: String,
    pub media_type: String,
    /// ID do AniList quando o próprio site informa (o MangaDex informa).
    pub anilist_id: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Resolved {
    pub mapping: SiteMapping,
    pub media: Media,
    pub entry: Option<Entry>,
}

/// Descobre qual obra do AniList é a página do site: mapeamento salvo → ID informado pelo
/// site → título no espelho → busca no AniList (1 request). O resultado fica salvo.
pub async fn resolve(
    state: &AppState, user: &User, input: &ResolveInput,
) -> Result<Option<Resolved>, AppError> {
    if !["ANIME", "MANGA"].contains(&input.media_type.as_str()) {
        return Err(AppError::BadRequest("mediaType must be ANIME or MANGA.".into()));
    }

    let pool = &state.database_pool;
    let mapping =
        tracking_repository::find_mapping(pool, user.id, &input.site, &input.identifier).await?;

    let media = match &mapping {
        Some(mapping) => entry_service::ensure_media(state, user, mapping.media_id).await?,
        None => match find_media(state, user, input).await? {
            Some(media) => media,
            None => return Ok(None),
        },
    };

    let mapping = match mapping {
        Some(mapping) => mapping,
        None => {
            tracking_repository::save_mapping(
                pool,
                user.id,
                &input.site,
                &input.identifier,
                media.id,
                &input.title,
                "AUTO",
            )
            .await?
        },
    };
    let entry = entry_repository::find(pool, user.id, media.id).await?;
    Ok(Some(Resolved { mapping, media, entry }))
}

async fn find_media(
    state: &AppState, user: &User, input: &ResolveInput,
) -> Result<Option<Media>, AppError> {
    if let Some(anilist_id) = input.anilist_id {
        return Ok(Some(entry_service::ensure_media(state, user, anilist_id).await?));
    }

    let title = input.title.trim();
    if title.is_empty() {
        return Ok(None);
    }

    let local =
        media_repository::search(&state.database_pool, title, Some(&input.media_type), 5).await?;
    if let Some(best) = local.into_iter().find(|hit| hit.similarity >= LOCAL_MATCH_THRESHOLD) {
        return Ok(Some(best.media));
    }

    let token = state.anilist_token(user)?;
    let remote = state.anilist.search(Some(&token), title, &input.media_type, 1).await?;
    let Some(media) = remote.into_iter().next().map(Media::from) else { return Ok(None) };
    media_repository::upsert(&state.database_pool, &media).await?;
    Ok(Some(media))
}

/// Correção manual: "essa página é a obra X". Nunca é sobrescrita pela busca automática.
pub async fn correct_mapping(
    state: &AppState, user: &User, site: &str, identifier: &str, media_id: i64, title: &str,
) -> Result<SiteMapping, AppError> {
    entry_service::ensure_media(state, user, media_id).await?;
    Ok(tracking_repository::save_mapping(
        &state.database_pool,
        user.id,
        site,
        identifier,
        media_id,
        title,
        "MANUAL",
    )
    .await?)
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SkipReason {
    InvalidProgress,
    AlreadyAhead,
    AlreadyCompleted,
}

/// Regras do rastreio automático (as mesmas ideias do MALSync):
/// - nunca diminui o progresso;
/// - não mexe no que já está concluído (rever é coisa manual);
/// - planejado, pausado ou largado vira "assistindo/lendo";
/// - chegar no total conclui.
pub fn plan_tracked_progress(
    current: &Entry, total: Option<i32>, progress: i32, today: chrono::NaiveDate,
) -> Result<Entry, SkipReason> {
    if progress <= 0 || total.is_some_and(|total| total > 0 && progress > total) {
        return Err(SkipReason::InvalidProgress);
    }
    if current.status == "COMPLETED" {
        return Err(SkipReason::AlreadyCompleted);
    }
    if progress <= current.progress {
        return Err(SkipReason::AlreadyAhead);
    }

    let mut next = current.clone();
    next.progress = progress;
    next.status = match current.status.as_str() {
        "REPEATING" => "REPEATING".into(),
        _ => "CURRENT".into(),
    };
    if total.is_some_and(|total| total > 0 && progress >= total) {
        next.status = "COMPLETED".into();
    }
    fill_dates(&mut next, today);
    Ok(next)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackInput {
    pub site: String,
    pub media_id: i64,
    pub progress: i32,
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackResult {
    pub applied: bool,
    pub skip_reason: Option<SkipReason>,
    pub saved: Option<SavedEntry>,
}

pub async fn track(
    state: &AppState, user: &User, input: &TrackInput,
) -> Result<TrackResult, AppError> {
    let media = entry_service::ensure_media(state, user, input.media_id).await?;
    let current = entry_repository::find(&state.database_pool, user.id, media.id).await?;
    let base = current.clone().unwrap_or_else(|| Entry::blank(user.id, media.id));

    match plan_tracked_progress(&base, media.total_units(), input.progress, today_in_brasilia()) {
        Ok(next) => {
            let saved = entry_service::save(
                state,
                user,
                next,
                current.map(|entry| entry.progress),
                &input.site,
                input.url.as_deref(),
            )
            .await?;
            Ok(TrackResult { applied: true, skip_reason: None, saved: Some(saved) })
        },
        Err(reason) => Ok(TrackResult { applied: false, skip_reason: Some(reason), saved: None }),
    }
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::*;

    fn day() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 11, 7).unwrap()
    }

    fn listed(status: &str, progress: i32) -> Entry {
        Entry { status: status.into(), progress, anilist_entry_id: Some(99), ..Entry::blank(1, 10) }
    }

    #[test]
    fn test_tracking_new_media_starts_watching() {
        let next = plan_tracked_progress(&Entry::blank(1, 10), Some(12), 1, day()).unwrap();
        assert_eq!(next.status, "CURRENT");
        assert_eq!(next.progress, 1);
        assert_eq!(next.started_at, Some(day()));
    }

    #[test]
    fn test_tracking_never_goes_back() {
        assert_eq!(
            plan_tracked_progress(&listed("CURRENT", 5), Some(12), 5, day()).err(),
            Some(SkipReason::AlreadyAhead)
        );
        assert_eq!(
            plan_tracked_progress(&listed("CURRENT", 5), Some(12), 3, day()).err(),
            Some(SkipReason::AlreadyAhead)
        );
    }

    #[test]
    fn test_tracking_does_not_touch_completed() {
        assert_eq!(
            plan_tracked_progress(&listed("COMPLETED", 12), Some(12), 13, day()).err(),
            Some(SkipReason::InvalidProgress)
        );
        assert_eq!(
            plan_tracked_progress(&listed("COMPLETED", 12), None, 13, day()).err(),
            Some(SkipReason::AlreadyCompleted)
        );
    }

    #[test]
    fn test_tracking_last_episode_completes() {
        let next = plan_tracked_progress(&listed("CURRENT", 11), Some(12), 12, day()).unwrap();
        assert_eq!(next.status, "COMPLETED");
        assert_eq!(next.completed_at, Some(day()));
    }

    #[test]
    fn test_tracking_resumes_paused_and_keeps_repeating() {
        assert_eq!(
            plan_tracked_progress(&listed("PAUSED", 3), None, 4, day()).unwrap().status,
            "CURRENT"
        );
        assert_eq!(
            plan_tracked_progress(&listed("REPEATING", 3), None, 4, day()).unwrap().status,
            "REPEATING"
        );
    }

    #[test]
    fn test_tracking_rejects_zero_and_over_total() {
        assert_eq!(
            plan_tracked_progress(&listed("CURRENT", 0), Some(12), 0, day()).err(),
            Some(SkipReason::InvalidProgress)
        );
        assert_eq!(
            plan_tracked_progress(&listed("CURRENT", 0), Some(12), 13, day()).err(),
            Some(SkipReason::InvalidProgress)
        );
    }
}
