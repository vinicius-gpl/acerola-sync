use serde::{Deserialize, Serialize};

use crate::data::models::user::UserProfile;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    /// Token do AniList obtido pela extensão no OAuth.
    pub access_token: String,
    #[serde(default)]
    pub device: String,
}

/// Configuração pública do login: o Client ID não é segredo (vai na URL do OAuth).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfigPayload {
    pub anilist_client_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginPayload {
    pub session_token: String,
    pub user: UserProfile,
}
