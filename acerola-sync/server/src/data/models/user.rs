use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub avatar_url: Option<String>,
    pub site_url: Option<String>,
    pub anilist_token_cipher: Vec<u8>,
    pub anilist_token_nonce: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// O que a extensão vê do usuário: nada do token.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: i64,
    pub name: String,
    pub avatar_url: Option<String>,
    pub site_url: Option<String>,
}

impl From<&User> for UserProfile {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            name: user.name.clone(),
            avatar_url: user.avatar_url.clone(),
            site_url: user.site_url.clone(),
        }
    }
}
