use chrono::Utc;

use crate::{
    bios::state::AppState,
    core::services::sync as sync_service,
    data::{
        models::user::{User, UserProfile},
        repositories::users as user_repository,
    },
    infra::{crypto, error::AppError},
};

pub struct LoginResult {
    pub session_token: String,
    pub user: UserProfile,
}

/// Recebe o token do AniList que a extensão pegou no OAuth (implicit grant, como o AniMouto),
/// confere de quem ele é, guarda criptografado e devolve um token de sessão do server.
pub async fn login(
    state: &AppState, anilist_token: &str, device: &str,
) -> Result<LoginResult, AppError> {
    let viewer = state.anilist.viewer(anilist_token).await?;
    ensure_allowed(state, viewer.id).await?;

    let (cipher, nonce) = crypto::encrypt(&state.encryption_key, anilist_token)?;
    let now = Utc::now();
    let mut transaction = state.database_pool.begin().await?;
    let is_first_login = user_repository::find(&mut *transaction, viewer.id).await?.is_none();
    let user = user_repository::upsert(
        &mut *transaction,
        &User {
            id: viewer.id,
            name: viewer.name,
            avatar_url: viewer.avatar.and_then(|avatar| avatar.large),
            site_url: viewer.site_url,
            anilist_token_cipher: cipher,
            anilist_token_nonce: nonce,
            created_at: now,
            updated_at: now,
        },
    )
    .await?;

    let session_token = crypto::generate_session_token();
    user_repository::create_session(
        &mut *transaction,
        user.id,
        &crypto::hash_token(&session_token),
        device,
    )
    .await?;
    transaction.commit().await?;

    tracing::info!("[Auth] User {} logged in from '{}'", user.id, device);

    // O espelho começa vazio: o primeiro login já puxa a lista inteira.
    if is_first_login {
        let state = state.clone();
        let user = user.clone();
        tokio::spawn(async move {
            if let Err(error) = sync_service::run(&state, &user, "LOGIN", true).await {
                tracing::warn!("[Auth] Initial sync failed: {}", error);
            }
        });
    }

    Ok(LoginResult { session_token, user: UserProfile::from(&user) })
}

async fn ensure_allowed(state: &AppState, anilist_user_id: i64) -> Result<(), AppError> {
    if let Some(allowed) = state.allowed_anilist_user_id {
        if allowed != anilist_user_id {
            return Err(AppError::Forbidden(
                "This instance is locked to another AniList user.".into(),
            ));
        }
        return Ok(());
    }

    // Uso pessoal: sem a variável, quem logou primeiro é o dono da instância.
    let owners = user_repository::find_all(&state.database_pool).await?;
    if owners.iter().any(|owner| owner.id != anilist_user_id) {
        return Err(AppError::Forbidden(
            "This instance already belongs to another AniList user.".into(),
        ));
    }
    Ok(())
}

pub async fn authenticate(state: &AppState, session_token: &str) -> Result<User, AppError> {
    user_repository::find_by_session(&state.database_pool, &crypto::hash_token(session_token))
        .await?
        .ok_or(AppError::Unauthorized)
}

pub async fn logout(state: &AppState, session_token: &str) -> Result<(), AppError> {
    user_repository::revoke_session(&state.database_pool, &crypto::hash_token(session_token))
        .await?;
    Ok(())
}
