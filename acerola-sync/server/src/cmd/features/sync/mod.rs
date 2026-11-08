use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;

use super::auth::AuthUser;
use crate::{
    bios::state::AppState,
    cmd::events::sync::{
        FullSyncIntervalRequest, LogsQuery, ScheduleRequest, SyncLogsPayload, SyncQuery,
        SyncStatusPayload,
    },
    core::services::{schedule, sync as sync_service},
    data::{
        models::sync::{SyncRun, SyncSettings},
        repositories::{entries as entry_repository, sync as sync_repository},
    },
    infra::error::AppError,
};

/// Começa o sync e responde na hora (202); o andamento sai em `/sync/runs/{id}/logs`.
pub async fn run(
    State(state): State<AppState>, auth: AuthUser, Query(query): Query<SyncQuery>,
) -> Result<(StatusCode, Json<SyncRun>), AppError> {
    let run = sync_service::start(&state, &auth.user, "MANUAL", query.full).await?;
    Ok((StatusCode::ACCEPTED, Json(run)))
}

pub async fn logs(
    State(state): State<AppState>, auth: AuthUser, Path(run_id): Path<i64>,
    Query(query): Query<LogsQuery>,
) -> Result<Json<SyncLogsPayload>, AppError> {
    let pool = &state.database_pool;
    let run = sync_repository::find_run(pool, auth.user.id, run_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Sync run not found.".into()))?;
    let logs = sync_repository::logs_after(pool, auth.user.id, run_id, query.after).await?;
    Ok(Json(SyncLogsPayload { run, logs }))
}

pub async fn status(
    State(state): State<AppState>, auth: AuthUser,
) -> Result<Json<SyncStatusPayload>, AppError> {
    let pool = &state.database_pool;
    Ok(Json(SyncStatusPayload {
        settings: sync_repository::settings(pool, auth.user.id).await?,
        runs: sync_repository::recent_runs(pool, auth.user.id, 10).await?,
        running: state.sync_lock.try_lock().is_err(),
        pending_entries: entry_repository::find_dirty(pool, auth.user.id).await?.len(),
    }))
}

/// `PUT /sync/full-interval`: de quanto em quanto tempo o automático puxa a lista inteira.
pub async fn save_full_sync_interval(
    State(state): State<AppState>, auth: AuthUser, Json(request): Json<FullSyncIntervalRequest>,
) -> Result<Json<SyncSettings>, AppError> {
    if !sync_service::FULL_SYNC_INTERVALS.contains(&request.hours) {
        return Err(AppError::BadRequest(format!(
            "hours must be one of {:?}.",
            sync_service::FULL_SYNC_INTERVALS
        )));
    }
    Ok(Json(
        sync_repository::save_full_sync_interval(&state.database_pool, auth.user.id, request.hours)
            .await?,
    ))
}

pub async fn save_schedule(
    State(state): State<AppState>, auth: AuthUser, Json(request): Json<ScheduleRequest>,
) -> Result<Json<SyncSettings>, AppError> {
    let mut times = request.times;
    times.sort();
    times.dedup();
    if times.len() > 24 {
        return Err(AppError::BadRequest("At most 24 scheduled times.".into()));
    }

    // O horário que já passou hoje conta como atendido: salvar não dispara um sync na hora.
    let last_slot = schedule::latest_slot(&times, Utc::now());
    Ok(Json(
        sync_repository::save_schedule(
            &state.database_pool,
            auth.user.id,
            request.enabled,
            &times,
            last_slot,
        )
        .await?,
    ))
}
