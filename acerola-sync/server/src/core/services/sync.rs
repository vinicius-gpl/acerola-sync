use std::collections::HashSet;

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use tokio::sync::OwnedMutexGuard;

use crate::{
    bios::state::AppState,
    core::services::entries as entry_service,
    data::{
        models::{
            entry::Entry,
            media::{timestamp, Media},
            sync::SyncRun,
            user::User,
        },
        repositories::{
            entries as entry_repository, media as media_repository,
            sync::{self as sync_repository, RunTotals},
        },
    },
    infra::{anilist::types::MediaListEntry, error::AppError},
};

pub const MEDIA_TYPES: [&str; 2] = ["ANIME", "MANGA"];

/// De quanto em quanto tempo a lista inteira é puxada (e o que foi apagado no AniList some
/// daqui). Entre uma e outra, o sync é incremental.
/// Intervalos que a tela oferece para a lista inteira automática (`0` = só no botão).
pub const FULL_SYNC_INTERVALS: [i32; 5] = [0, 6, 24, 72, 168];
/// Folga do incremental: reprocessa o que mudou um pouco antes do último pull, para não perder
/// nada que mudou enquanto o pull anterior rodava.
const INCREMENTAL_MARGIN: Duration = Duration::minutes(5);
/// Teto do incremental (20 × 50 entradas). Passou disso, vale mais a lista inteira.
const MAX_INCREMENTAL_PAGES: u32 = 20;
const AIRING_BATCH: usize = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SyncMode {
    Full,
    Incremental,
}

impl SyncMode {
    fn as_str(self) -> &'static str {
        match self {
            SyncMode::Full => "FULL",
            SyncMode::Incremental => "INCREMENTAL",
        }
    }
}

/// Lista inteira quando pedida, quando nunca rodou ou quando a última passou do intervalo
/// escolhido (`every_hours`; `0` = automático nunca puxa a lista inteira).
pub fn choose_mode(
    force_full: bool, last_full: Option<DateTime<Utc>>, last_pull: Option<DateTime<Utc>>,
    now: DateTime<Utc>, every_hours: i32,
) -> SyncMode {
    match (force_full, last_full, last_pull) {
        (true, _, _) | (_, None, _) | (_, _, None) => SyncMode::Full,
        (_, Some(last_full), _)
            if every_hours > 0 && now - last_full >= Duration::hours(every_hours.into()) =>
        {
            SyncMode::Full
        },
        _ => SyncMode::Incremental,
    }
}

/// Grava cada passo em `sync_logs` (a tela acompanha ao vivo) e no log do processo.
struct SyncLogger<'a> {
    state: &'a AppState,
    run_id: i64,
}

impl SyncLogger<'_> {
    async fn write(&self, level: &str, message: String) {
        match level {
            "ERROR" => tracing::error!("[Sync] Run {}: {}", self.run_id, message),
            "WARN" => tracing::warn!("[Sync] Run {}: {}", self.run_id, message),
            _ => tracing::info!("[Sync] Run {}: {}", self.run_id, message),
        }
        if let Err(error) =
            sync_repository::insert_log(&self.state.database_pool, self.run_id, level, &message)
                .await
        {
            tracing::warn!("[Sync] Could not store log line: {}", error);
        }
    }

    async fn info(&self, message: impl Into<String>) {
        self.write("INFO", message.into()).await;
    }

    async fn warn(&self, message: impl Into<String>) {
        self.write("WARN", message.into()).await;
    }
}

/// Um sync já registrado em `sync_runs`, segurando o lock até terminar.
struct PreparedRun {
    _guard: OwnedMutexGuard<()>,
    run: SyncRun,
    mode: SyncMode,
    started_at: DateTime<Utc>,
    last_pull_at: Option<DateTime<Utc>>,
}

async fn prepare(
    state: &AppState, user: &User, trigger: &str, force_full: bool,
) -> Result<PreparedRun, AppError> {
    let Ok(guard) = state.sync_lock.clone().try_lock_owned() else {
        return Err(AppError::Conflict("A sync is already running.".into()));
    };

    let settings = sync_repository::settings(&state.database_pool, user.id).await?;
    let started_at = Utc::now();
    let mode = choose_mode(
        force_full,
        settings.last_full_sync_at,
        settings.last_pull_at,
        started_at,
        settings.full_sync_every_hours,
    );
    let run =
        sync_repository::start_run(&state.database_pool, user.id, trigger, mode.as_str()).await?;

    Ok(PreparedRun { _guard: guard, run, mode, started_at, last_pull_at: settings.last_pull_at })
}

/// Atualiza o espelho e espera terminar (agenda e primeiro login). Envia o que está pendente
/// e puxa do AniList: a lista inteira (2 requests numa lista comum) ou só o que mudou desde o
/// último pull (normalmente 1 request), mais o próximo episódio do que está em lançamento.
pub async fn run(
    state: &AppState, user: &User, trigger: &str, force_full: bool,
) -> Result<SyncRun, AppError> {
    let prepared = prepare(state, user, trigger, force_full).await?;
    execute(state, user, prepared).await
}

/// Começa o sync em segundo plano e devolve o registro na hora: a tela acompanha pelos logs.
pub async fn start(
    state: &AppState, user: &User, trigger: &str, force_full: bool,
) -> Result<SyncRun, AppError> {
    let prepared = prepare(state, user, trigger, force_full).await?;
    let run = prepared.run.clone();

    let state = state.clone();
    let user = user.clone();
    tokio::spawn(async move {
        if let Err(error) = execute(&state, &user, prepared).await {
            tracing::warn!("[Sync] Background sync failed: {}", error);
        }
    });
    Ok(run)
}

async fn execute(
    state: &AppState, user: &User, prepared: PreparedRun,
) -> Result<SyncRun, AppError> {
    let PreparedRun { _guard, run, mode, started_at, last_pull_at } = prepared;
    let logger = SyncLogger { state, run_id: run.id };
    let requests_before = state.anilist.requests_made();
    logger.info(format!("Sync {} started ({})", mode.as_str().to_lowercase(), run.trigger)).await;

    let mut totals = RunTotals { pulled: 0, pushed: 0, removed: 0, anilist_requests: 0 };
    let result = match mode {
        SyncMode::Full => mirror_full(state, user, &logger, &mut totals).await,
        SyncMode::Incremental => {
            let since = last_pull_at.unwrap_or(started_at) - INCREMENTAL_MARGIN;
            mirror_incremental(state, user, &logger, &mut totals, since).await
        },
    };

    if result.is_ok() {
        sync_repository::mark_pulled(
            &state.database_pool,
            user.id,
            started_at,
            mode == SyncMode::Full,
        )
        .await?;
    }

    totals.anilist_requests = (state.anilist.requests_made() - requests_before) as i32;
    let error = result.as_ref().err().map(ToString::to_string);
    match &error {
        None => {
            logger
                .info(format!(
                    "Done: {} pulled, {} pushed, {} removed, {} AniList request(s)",
                    totals.pulled, totals.pushed, totals.removed, totals.anilist_requests
                ))
                .await
        },
        Some(error) => logger.write("ERROR", format!("Failed: {error}")).await,
    }

    Ok(sync_repository::finish_run(&state.database_pool, run.id, &totals, error.as_deref()).await?)
}

async fn push_pending(
    state: &AppState, user: &User, logger: &SyncLogger<'_>, totals: &mut RunTotals,
) -> Result<HashSet<i64>, AppError> {
    let pending = entry_repository::find_dirty(&state.database_pool, user.id).await?;
    if !pending.is_empty() {
        logger.info(format!("Sending {} pending change(s) to AniList", pending.len())).await;
        totals.pushed = entry_service::push_pending(state, user).await?;
    }

    // O que ainda não chegou no AniList não pode ser sobrescrito pelo que vem de lá.
    let still_pending: HashSet<i64> = entry_repository::find_dirty(&state.database_pool, user.id)
        .await?
        .into_iter()
        .map(|entry| entry.media_id)
        .collect();
    if !still_pending.is_empty() {
        logger
            .warn(format!("{} change(s) still pending; kept as they are", still_pending.len()))
            .await;
    }
    Ok(still_pending)
}

async fn store_entries(
    state: &AppState, user: &User, remote: &[MediaListEntry], pending: &HashSet<i64>,
) -> Result<i32, AppError> {
    let mut transaction = state.database_pool.begin().await?;
    let mut stored = 0;
    for remote_entry in remote {
        media_repository::upsert(&mut *transaction, &Media::from(remote_entry.media.clone()))
            .await?;
        if pending.contains(&remote_entry.media.id) {
            continue;
        }
        entry_repository::upsert(&mut *transaction, &Entry::from_anilist(user.id, remote_entry))
            .await?;
        stored += 1;
    }
    transaction.commit().await?;
    Ok(stored)
}

async fn mirror_full(
    state: &AppState, user: &User, logger: &SyncLogger<'_>, totals: &mut RunTotals,
) -> Result<(), AppError> {
    let pending = push_pending(state, user, logger, totals).await?;
    let token = state.anilist_token(user)?;

    for media_type in MEDIA_TYPES {
        logger.info(format!("Pulling the whole {} list", media_type.to_lowercase())).await;
        let remote = state.anilist.media_list(&token, user.id, media_type).await?;
        totals.pulled += store_entries(state, user, &remote, &pending).await?;

        let kept: Vec<i64> = remote.iter().map(|entry| entry.media.id).collect();
        let removed =
            entry_repository::delete_missing(&state.database_pool, user.id, media_type, &kept)
                .await?;
        totals.removed += removed as i32;
        logger
            .info(format!(
                "{}: {} entries, {} removed",
                media_type.to_lowercase(),
                remote.len(),
                removed
            ))
            .await;
    }
    Ok(())
}

async fn mirror_incremental(
    state: &AppState, user: &User, logger: &SyncLogger<'_>, totals: &mut RunTotals,
    since: DateTime<Utc>,
) -> Result<(), AppError> {
    let pending = push_pending(state, user, logger, totals).await?;
    let token = state.anilist_token(user)?;
    logger.info(format!("Pulling changes since {}", since.format("%Y-%m-%d %H:%M UTC"))).await;

    for page in 1..=MAX_INCREMENTAL_PAGES {
        let (entries, has_next) = state.anilist.recently_updated(&token, user.id, page).await?;
        let changed: Vec<MediaListEntry> = entries
            .into_iter()
            .take_while(|entry| timestamp(entry.updated_at).is_none_or(|at| at >= since))
            .collect();
        let reached_old = changed.len() < queries_page_size();

        totals.pulled += store_entries(state, user, &changed, &pending).await?;
        logger.info(format!("Page {page}: {} changed entr(ies)", changed.len())).await;

        if reached_old || !has_next {
            refresh_airing(state, user, logger, &token).await?;
            return Ok(());
        }
    }

    logger.warn("Too many changes for an incremental sync; pulling the whole list").await;
    mirror_full(state, user, logger, totals).await
}

fn queries_page_size() -> usize {
    crate::infra::anilist::queries::PAGE_SIZE as usize
}

/// Próximo episódio do que está em lançamento: a query leve não muda quando ninguém mexe na
/// entrada, então o incremental atualiza isso à parte (1 request a cada 50 obras).
async fn refresh_airing(
    state: &AppState, user: &User, logger: &SyncLogger<'_>, token: &str,
) -> Result<(), AppError> {
    let ids = media_repository::releasing_ids_for_user(&state.database_pool, user.id).await?;
    if ids.is_empty() {
        return Ok(());
    }
    logger.info(format!("Refreshing airing info of {} title(s)", ids.len())).await;

    for batch in ids.chunks(AIRING_BATCH) {
        for info in state.anilist.airing(token, batch).await? {
            let next = info.next_airing_episode.as_ref();
            media_repository::update_airing(
                &state.database_pool,
                info.id,
                info.status.as_deref(),
                info.episodes,
                next.map(|next| next.episode),
                timestamp(next.map(|next| next.airing_at)),
            )
            .await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    fn at(hour: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 11, 7, hour, 0, 0).unwrap()
    }

    #[test]
    fn teste_primeiro_sync_e_completo() {
        assert_eq!(choose_mode(false, None, None, at(12), 24), SyncMode::Full);
    }

    #[test]
    fn teste_sync_recente_e_incremental() {
        assert_eq!(
            choose_mode(false, Some(at(1)), Some(at(10)), at(12), 24),
            SyncMode::Incremental
        );
    }

    #[test]
    fn teste_completo_depois_de_24h_ou_quando_pedido() {
        let yesterday = at(12) - Duration::hours(25);
        assert_eq!(choose_mode(false, Some(yesterday), Some(at(10)), at(12), 24), SyncMode::Full);
        assert_eq!(choose_mode(true, Some(at(11)), Some(at(11)), at(12), 24), SyncMode::Full);
        // Semanal: um dia depois ainda é incremental; só no botão: nunca automático.
        assert_eq!(
            choose_mode(false, Some(yesterday), Some(at(10)), at(12), 168),
            SyncMode::Incremental
        );
        assert_eq!(
            choose_mode(false, Some(at(12) - Duration::days(30)), Some(at(10)), at(12), 0),
            SyncMode::Incremental
        );
        assert_eq!(choose_mode(true, Some(at(11)), Some(at(11)), at(12), 0), SyncMode::Full);
        // Nunca rodou: puxa tudo mesmo no "só no botão".
        assert_eq!(choose_mode(false, None, None, at(12), 0), SyncMode::Full);
    }
}
