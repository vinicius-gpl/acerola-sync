use std::time::Duration;

use chrono::Utc;

use crate::{
    bios::state::AppState,
    core::services::{entries as entry_service, schedule, sync as sync_service},
    data::repositories::{sync as sync_repository, users as user_repository},
    infra::error::AppError,
};

const TICK: Duration = Duration::from_secs(30);
/// A cada quantos ticks tenta reenviar o que ficou pendente (10 × 30 s = 5 min).
const PUSH_EVERY_TICKS: u32 = 10;

/// Loop de fundo: roda o sync nos horários escolhidos (UTC), o automático de hora em hora e
/// reenvia pendências.
pub fn spawn(state: AppState) {
    tokio::spawn(async move {
        if let Err(error) = sync_repository::fail_stale_runs(&state.database_pool).await {
            tracing::warn!("[Scheduler] Could not close stale runs: {}", error);
        }

        let mut interval = tokio::time::interval(TICK);
        let mut tick: u32 = 0;
        loop {
            interval.tick().await;
            tick = tick.wrapping_add(1);

            if let Err(error) = run_due_syncs(&state).await {
                tracing::warn!("[Scheduler] Scheduled sync check failed: {}", error);
            }
            if let Err(error) = run_auto_syncs(&state).await {
                tracing::warn!("[Scheduler] Automatic sync check failed: {}", error);
            }
            if tick.is_multiple_of(PUSH_EVERY_TICKS) {
                if let Err(error) = push_all_pending(&state).await {
                    tracing::warn!("[Scheduler] Pending push failed: {}", error);
                }
            }
        }
    });
}

async fn run_due_syncs(state: &AppState) -> Result<(), AppError> {
    let now = Utc::now();
    for settings in sync_repository::all_enabled(&state.database_pool).await? {
        let Some(slot) =
            schedule::due_slot(&settings.schedule_times, settings.last_scheduled_slot, now)
        else {
            continue;
        };
        let Some(user) = user_repository::find(&state.database_pool, settings.user_id).await?
        else {
            continue;
        };

        // Marca antes de rodar: se o sync falhar, ele não fica tentando a cada 30 s.
        sync_repository::mark_slot_done(&state.database_pool, user.id, slot).await?;
        tracing::info!("[Scheduler] Running scheduled sync for slot {}", slot);
        if let Err(error) = sync_service::run(state, &user, "SCHEDULED", false).await {
            tracing::warn!("[Scheduler] Scheduled sync failed: {}", error);
        }
    }
    Ok(())
}

/// Sync automático: o que mudou de hora em hora e, quando passa do intervalo escolhido, a lista
/// inteira (o `choose_mode` decide). Mantém o próximo episódio em dia para os avisos da extensão.
async fn run_auto_syncs(state: &AppState) -> Result<(), AppError> {
    let now = Utc::now();
    for settings in sync_repository::all_auto(&state.database_pool).await? {
        let last =
            sync_repository::last_run_started_at(&state.database_pool, settings.user_id).await?;
        if !schedule::auto_due(settings.full_sync_every_hours, last, now) {
            continue;
        }
        let Some(user) = user_repository::find(&state.database_pool, settings.user_id).await?
        else {
            continue;
        };
        match sync_service::run(state, &user, "AUTO", false).await {
            Ok(_) | Err(AppError::Conflict(_)) => {},
            Err(error) => tracing::warn!("[Scheduler] Automatic sync failed: {}", error),
        }
    }
    Ok(())
}

async fn push_all_pending(state: &AppState) -> Result<(), AppError> {
    for user in user_repository::find_all(&state.database_pool).await? {
        let pushed = entry_service::push_pending(state, &user).await?;
        if pushed > 0 {
            tracing::info!("[Scheduler] Pushed {} pending entries", pushed);
        }
    }
    Ok(())
}
