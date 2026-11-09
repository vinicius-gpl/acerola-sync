use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use regex::Regex;

use super::auth::AuthUser;
use crate::{
    bios::state::AppState,
    cmd::events::tracking::{CustomSiteRequest, HistoryQuery, MappingKeyQuery, MappingRequest},
    core::services::tracking::{
        self as tracking_service, ResolveInput, Resolved, TrackInput, TrackResult,
    },
    data::{
        models::tracking::{CustomSite, HistoryItem, SiteMapping},
        repositories::tracking::{self as tracking_repository, CustomSiteInput},
    },
    infra::error::AppError,
};

pub async fn resolve(
    State(state): State<AppState>, auth: AuthUser, Json(input): Json<ResolveInput>,
) -> Result<Json<Option<Resolved>>, AppError> {
    Ok(Json(tracking_service::resolve(&state, &auth.user, &input).await?))
}

pub async fn track(
    State(state): State<AppState>, auth: AuthUser, Json(input): Json<TrackInput>,
) -> Result<Json<TrackResult>, AppError> {
    Ok(Json(tracking_service::track(&state, &auth.user, &input).await?))
}

pub async fn save_mapping(
    State(state): State<AppState>, auth: AuthUser, Json(request): Json<MappingRequest>,
) -> Result<Json<SiteMapping>, AppError> {
    Ok(Json(
        tracking_service::correct_mapping(
            &state,
            &auth.user,
            &request.site,
            &request.identifier,
            request.media_id,
            &request.title,
        )
        .await?,
    ))
}

pub async fn delete_mapping(
    State(state): State<AppState>, auth: AuthUser, Query(query): Query<MappingKeyQuery>,
) -> Result<StatusCode, AppError> {
    tracking_repository::delete_mapping(
        &state.database_pool,
        auth.user.id,
        &query.site,
        &query.identifier,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn history(
    State(state): State<AppState>, auth: AuthUser, Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<HistoryItem>>, AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    Ok(Json(tracking_repository::recent_history(&state.database_pool, auth.user.id, limit).await?))
}

pub async fn list_custom_sites(
    State(state): State<AppState>, auth: AuthUser,
) -> Result<Json<Vec<CustomSite>>, AppError> {
    Ok(Json(tracking_repository::list_custom_sites(&state.database_pool, auth.user.id).await?))
}

/// Confere a regex do site personalizado antes de salvar: ela roda na extensão, e uma regex
/// quebrada só apareceria lá, em silêncio.
pub fn validate_custom_site(request: &CustomSiteRequest) -> Result<(), AppError> {
    if request.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required.".into()));
    }
    if !["ANIME", "MANGA"].contains(&request.media_type.as_str()) {
        return Err(AppError::BadRequest("mediaType must be ANIME or MANGA.".into()));
    }
    if !request.match_pattern.contains("://") || !request.match_pattern.ends_with('*') {
        return Err(AppError::BadRequest("matchPattern must look like https://site.com/*".into()));
    }
    let regex = Regex::new(&request.url_pattern)
        .map_err(|error| AppError::BadRequest(format!("Invalid urlPattern: {error}")))?;
    let names: Vec<&str> = regex.capture_names().flatten().collect();
    // Com o número fora da URL, a regex da URL só precisa achar a obra.
    let from_url = request.progress_source == "url";
    let required: &[&str] = if from_url { &["id", "progress"] } else { &["id"] };
    for required in required {
        if !names.contains(required) {
            return Err(AppError::BadRequest(format!(
                "urlPattern needs a named group (?<{required}>...)."
            )));
        }
    }
    match request.progress_source.as_str() {
        "url" | "title" => {},
        "selector" if trimmed(&request.progress_selector).is_some() => {},
        "selector" => {
            return Err(AppError::BadRequest(
                "progressSelector is required when progressSource is selector.".into(),
            ));
        },
        _ => {
            return Err(AppError::BadRequest(
                "progressSource must be url, title or selector.".into(),
            ));
        },
    }
    if let Some(pattern) = trimmed(&request.progress_pattern).filter(|_| !from_url) {
        Regex::new(pattern)
            .map_err(|error| AppError::BadRequest(format!("Invalid progressPattern: {error}")))?;
    }
    if let Some(url) = request.search_url.as_deref().map(str::trim).filter(|url| !url.is_empty()) {
        if !(url.starts_with("https://") || url.starts_with("http://")) || !url.contains("{title}")
        {
            return Err(AppError::BadRequest(
                "searchUrl must be an http(s) address with {title}.".into(),
            ));
        }
    }
    Ok(())
}

fn trimmed(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|value| !value.is_empty())
}

fn input(request: &CustomSiteRequest) -> CustomSiteInput<'_> {
    let from_url = request.progress_source == "url";
    CustomSiteInput {
        name: request.name.trim(),
        media_type: &request.media_type,
        match_pattern: request.match_pattern.trim(),
        url_pattern: &request.url_pattern,
        title_selector: request
            .title_selector
            .as_deref()
            .map(str::trim)
            .filter(|selector| !selector.is_empty()),
        enabled: request.enabled,
        search_url: request.search_url.as_deref().map(str::trim).filter(|url| !url.is_empty()),
        progress_source: &request.progress_source,
        // Fonte na URL: seletor e regex do número não valem, não ficam guardados.
        progress_selector: trimmed(&request.progress_selector)
            .filter(|_| request.progress_source == "selector"),
        progress_pattern: trimmed(&request.progress_pattern).filter(|_| !from_url),
    }
}

pub async fn create_custom_site(
    State(state): State<AppState>, auth: AuthUser, Json(request): Json<CustomSiteRequest>,
) -> Result<Json<CustomSite>, AppError> {
    validate_custom_site(&request)?;
    Ok(Json(
        tracking_repository::insert_custom_site(
            &state.database_pool,
            auth.user.id,
            &input(&request),
        )
        .await?,
    ))
}

pub async fn update_custom_site(
    State(state): State<AppState>, auth: AuthUser, Path(id): Path<String>,
    Json(request): Json<CustomSiteRequest>,
) -> Result<Json<CustomSite>, AppError> {
    validate_custom_site(&request)?;
    let id = parse_id(&id)?;
    Ok(Json(
        tracking_repository::update_custom_site(
            &state.database_pool,
            auth.user.id,
            id,
            &input(&request),
        )
        .await?,
    ))
}

pub async fn delete_custom_site(
    State(state): State<AppState>, auth: AuthUser, Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    tracking_repository::delete_custom_site(&state.database_pool, auth.user.id, parse_id(&id)?)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

fn parse_id(id: &str) -> Result<i64, AppError> {
    id.parse().map_err(|_| AppError::BadRequest("Invalid id.".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(url_pattern: &str) -> CustomSiteRequest {
        CustomSiteRequest {
            name: "Meu leitor".into(),
            media_type: "MANGA".into(),
            match_pattern: "https://leitor.exemplo.com/*".into(),
            url_pattern: url_pattern.into(),
            title_selector: None,
            enabled: true,
            search_url: None,
            progress_source: "url".into(),
            progress_selector: None,
            progress_pattern: None,
        }
    }

    #[test]
    fn test_custom_site_search_url_needs_title_placeholder() {
        let mut site = request(r"/obra/(?<id>[^/]+)/(?<progress>\d+)");
        site.search_url = Some("https://leitor.exemplo.com/busca".into());
        assert!(validate_custom_site(&site).is_err());
        site.search_url = Some("javascript:alert({title})".into());
        assert!(validate_custom_site(&site).is_err());
        site.search_url = Some("https://leitor.exemplo.com/busca?q={title}".into());
        assert!(validate_custom_site(&site).is_ok());
        site.search_url = Some("  ".into());
        assert!(validate_custom_site(&site).is_ok());
    }

    #[test]
    fn test_custom_site_requires_id_and_progress_groups() {
        assert!(validate_custom_site(&request(r"/obra/(?<id>[^/]+)/cap/(?<progress>\d+)")).is_ok());
        assert!(validate_custom_site(&request(r"/obra/(?<id>[^/]+)/cap/\d+")).is_err());
        assert!(validate_custom_site(&request(r"/obra/(?<id>[^/]+")).is_err());
    }

    #[test]
    fn test_custom_site_requires_match_pattern_with_wildcard() {
        let mut bad = request(r"/obra/(?<id>[^/]+)/cap/(?<progress>\d+)");
        bad.match_pattern = "leitor.exemplo.com".into();
        assert!(validate_custom_site(&bad).is_err());
    }

    #[test]
    fn test_custom_site_progress_outside_url_only_needs_id_group() {
        let mut site = request(r"/read/(?<id>\d+)/\d+");
        assert!(validate_custom_site(&site).is_err());
        site.progress_source = "title".into();
        site.progress_pattern = Some(r"Cap\.\s*(?<progress>\d+)".into());
        assert!(validate_custom_site(&site).is_ok());
        site.progress_pattern = Some("(".into());
        assert!(validate_custom_site(&site).is_err());
    }

    #[test]
    fn test_custom_site_selector_source_needs_selector() {
        let mut site = request(r"/read/(?<id>\d+)/\d+");
        site.progress_source = "selector".into();
        assert!(validate_custom_site(&site).is_err());
        site.progress_selector = Some("header span".into());
        assert!(validate_custom_site(&site).is_ok());
        site.progress_source = "html".into();
        assert!(validate_custom_site(&site).is_err());
    }

    #[test]
    fn test_custom_site_url_source_drops_progress_fields() {
        let mut site = request(r"/obra/(?<id>[^/]+)/cap/(?<progress>\d+)");
        site.progress_selector = Some("span".into());
        site.progress_pattern = Some(r"\d+".into());
        let input = input(&site);
        assert_eq!(input.progress_source, "url");
        assert!(input.progress_selector.is_none() && input.progress_pattern.is_none());
    }
}
