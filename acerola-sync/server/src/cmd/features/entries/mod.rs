use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};

use super::auth::AuthUser;
use crate::{
    bios::state::AppState,
    cmd::events::entries::{FacetsQuery, ListEntriesQuery},
    core::services::entries::{self as entry_service, SavedEntry},
    data::{
        models::entry::{EntryCount, EntryFacets, EntryPatch, EntryWithMedia},
        repositories::entries::{self as entry_repository, PageRequest},
    },
    infra::error::AppError,
};

pub async fn list(
    State(state): State<AppState>, auth: AuthUser, Query(query): Query<ListEntriesQuery>,
) -> Result<Json<Vec<EntryWithMedia>>, AppError> {
    let entries = entry_repository::list_with_media(
        &state.database_pool,
        auth.user.id,
        &query.filters(),
        query.sort(),
        PageRequest::new(query.limit, query.offset),
    )
    .await?;
    Ok(Json(entries))
}

pub async fn counts(
    State(state): State<AppState>, auth: AuthUser, Query(query): Query<ListEntriesQuery>,
) -> Result<Json<Vec<EntryCount>>, AppError> {
    Ok(Json(
        entry_repository::count_by_status(&state.database_pool, auth.user.id, &query.filters())
            .await?,
    ))
}

pub async fn facets(
    State(state): State<AppState>, auth: AuthUser, Query(query): Query<FacetsQuery>,
) -> Result<Json<EntryFacets>, AppError> {
    let media_type = query.media_type.as_deref().map(str::to_uppercase);
    Ok(Json(
        entry_repository::facets(&state.database_pool, auth.user.id, media_type.as_deref()).await?,
    ))
}

pub async fn update(
    State(state): State<AppState>, auth: AuthUser, Path(media_id): Path<i64>,
    Json(patch): Json<EntryPatch>,
) -> Result<Json<SavedEntry>, AppError> {
    Ok(Json(entry_service::update(&state, &auth.user, media_id, &patch).await?))
}

pub async fn delete(
    State(state): State<AppState>, auth: AuthUser, Path(media_id): Path<i64>,
) -> Result<StatusCode, AppError> {
    entry_service::delete(&state, &auth.user, media_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
