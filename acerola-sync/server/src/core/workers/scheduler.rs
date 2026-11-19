use std::time::Duration;

use chrono::Utc;

use crate::{
    bios::state::AppState,
    core::services::{entries as entry_service, schedule, sync as sync_service},
    data::repositories::{sync as sync_repository, users as user_repository},
    infra::error::AppError,
};

const TICK: Duration = Duration::from_secs(30);
/// Every how many ticks it tries to resend what was left pending (10 × 30 s = 5 min).
const PUSH_EVERY_TICKS: u32 = 10;

/// Background loop: runs the sync at the chosen times (UTC), the hourly automatic one and
/// resends pending changes.
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

        // Marks before running: if the sync fails, it does not keep retrying every 30 s.
        sync_repository::mark_slot_done(&state.database_pool, user.id, slot).await?;
        tracing::info!("[Scheduler] Running scheduled sync for slot {}", slot);
        if let Err(error) = sync_service::run(state, &user, "SCHEDULED", false).await {
            tracing::warn!("[Scheduler] Scheduled sync failed: {}", error);
        }
    }
    Ok(())
}

/// Automatic sync: what changed, hourly, and the whole list once the chosen interval is past
/// (`choose_mode` decides). Keeps the next episode up to date for the extension's notices.
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
