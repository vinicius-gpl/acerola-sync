use axum::{
    extract::{Path, Query, State},
    Json,
};

use super::auth::AuthUser;
use crate::{
    bios::state::AppState,
    cmd::events::media::{MediaDetailPayload, SearchQuery},
    core::services::{
        entries as entry_service,
        search::{self as search_service, SearchHit},
    },
    data::repositories::{entries as entry_repository, tracking as tracking_repository},
    infra::error::AppError,
};

pub async fn search(
    State(state): State<AppState>, auth: AuthUser, Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<SearchHit>>, AppError> {
    let media_type = query.media_type.as_deref().map(str::to_uppercase);
    Ok(Json(
        search_service::search(&state, &auth.user, &query.q, media_type.as_deref(), query.remote)
            .await?,
    ))
}

pub async fn detail(
    State(state): State<AppState>, auth: AuthUser, Path(media_id): Path<i64>,
) -> Result<Json<MediaDetailPayload>, AppError> {
    let media = entry_service::ensure_details(&state, &auth.user, media_id).await?;
    let entry = entry_repository::find(&state.database_pool, auth.user.id, media_id).await?;
    let visits =
        tracking_repository::last_visits(&state.database_pool, auth.user.id, media_id).await?;
    Ok(Json(MediaDetailPayload { media, entry, visits }))
}

/// `POST /entries/{media_id}/sync`: pendência enviada, obra e entrada puxadas de novo.
pub async fn sync_one(
    State(state): State<AppState>, auth: AuthUser, Path(media_id): Path<i64>,
) -> Result<Json<MediaDetailPayload>, AppError> {
    let (media, entry) = entry_service::sync_one(&state, &auth.user, media_id).await?;
    let visits =
        tracking_repository::last_visits(&state.database_pool, auth.user.id, media_id).await?;
    Ok(Json(MediaDetailPayload { media, entry, visits }))
}
