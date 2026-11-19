use serde::{Deserialize, Serialize};

use crate::data::models::user::UserProfile;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    /// AniList token the extension got through OAuth.
    pub access_token: String,
    #[serde(default)]
    pub device: String,
}

/// Public login configuration: the Client ID is not a secret (it goes in the OAuth URL).
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
