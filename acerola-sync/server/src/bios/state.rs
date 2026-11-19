use std::sync::Arc;

use sqlx::PgPool;
use tokio::sync::Mutex;

use crate::{
    data::models::user::User,
    infra::{anilist::AnilistClient, crypto, error::CryptoError},
};

/// State shared between the routes and the workers (the equivalent of Tauri's
/// `app_handle.manage`).
#[derive(Clone)]
pub struct AppState {
    pub database_pool: PgPool,
    pub anilist: AnilistClient,
    pub encryption_key: [u8; 32],
    pub anilist_client_id: String,
    pub allowed_anilist_user_id: Option<i64>,
    /// One sync at a time: the manual and the scheduled one never run together.
    pub sync_lock: Arc<Mutex<()>>,
}

impl AppState {
    pub fn new(
        database_pool: PgPool, anilist: AnilistClient, encryption_key: [u8; 32],
        anilist_client_id: String, allowed_anilist_user_id: Option<i64>,
    ) -> Self {
        Self {
            database_pool,
            anilist,
            encryption_key,
            anilist_client_id,
            allowed_anilist_user_id,
            sync_lock: Arc::new(Mutex::new(())),
        }
    }

    pub fn anilist_token(&self, user: &User) -> Result<String, CryptoError> {
        crypto::decrypt(&self.encryption_key, &user.anilist_token_cipher, &user.anilist_token_nonce)
    }
}
