use axum::{
    extract::{FromRequestParts, State},
    http::{header, request::Parts, StatusCode},
    Json,
};

use crate::{
    bios::state::AppState,
    cmd::events::auth::{AuthConfigPayload, LoginPayload, LoginRequest},
    core::services::auth as auth_service,
    data::models::user::{User, UserProfile},
    infra::error::AppError,
};

/// Usuário da sessão. Toda rota que recebe `AuthUser` exige `Authorization: Bearer <token>`.
pub struct AuthUser {
    pub user: User,
    pub session_token: String,
}

fn bearer(parts: &Parts) -> Option<String> {
    let value = parts.headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let token = value.strip_prefix("Bearer ")?.trim();
    (!token.is_empty()).then(|| token.to_string())
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, AppError> {
        let session_token = bearer(parts).ok_or(AppError::Unauthorized)?;
        let user = auth_service::authenticate(state, &session_token).await?;
        Ok(Self { user, session_token })
    }
}

/// Client ID do AniList vindo do `.env`, para a extensão montar o OAuth sem configurar nada.
pub async fn config(State(state): State<AppState>) -> Json<AuthConfigPayload> {
    Json(AuthConfigPayload { anilist_client_id: state.anilist_client_id.clone() })
}

pub async fn login(
    State(state): State<AppState>, Json(request): Json<LoginRequest>,
) -> Result<Json<LoginPayload>, AppError> {
    let access_token = request.access_token.trim();
    if access_token.is_empty() {
        return Err(AppError::BadRequest("accessToken is required.".into()));
    }
    let device = if request.device.trim().is_empty() { "extension" } else { request.device.trim() };

    let result = auth_service::login(&state, access_token, device).await?;
    Ok(Json(LoginPayload { session_token: result.session_token, user: result.user }))
}

pub async fn logout(State(state): State<AppState>, auth: AuthUser) -> Result<StatusCode, AppError> {
    auth_service::logout(&state, &auth.session_token).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn me(auth: AuthUser) -> Json<UserProfile> {
    Json(UserProfile::from(&auth.user))
}
