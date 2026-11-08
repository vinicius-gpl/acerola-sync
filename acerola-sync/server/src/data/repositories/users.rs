use chrono::Utc;
use sqlx::{PgExecutor, PgPool};

use crate::{data::models::user::User, infra::error::DbError};

pub async fn count(pool: &PgPool) -> Result<i64, DbError> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users").fetch_one(pool).await?;
    Ok(count)
}

pub async fn find(executor: impl PgExecutor<'_>, id: i64) -> Result<Option<User>, DbError> {
    Ok(sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(executor)
        .await?)
}

pub async fn find_all(pool: &PgPool) -> Result<Vec<User>, DbError> {
    Ok(sqlx::query_as("SELECT * FROM users ORDER BY id").fetch_all(pool).await?)
}

pub async fn upsert(executor: impl PgExecutor<'_>, user: &User) -> Result<User, DbError> {
    Ok(sqlx::query_as(
        "INSERT INTO users (id, name, avatar_url, site_url, anilist_token_cipher, anilist_token_nonce)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url,
             site_url = EXCLUDED.site_url,
             anilist_token_cipher = EXCLUDED.anilist_token_cipher,
             anilist_token_nonce = EXCLUDED.anilist_token_nonce,
             updated_at = $7
         RETURNING *",
    )
    .bind(user.id)
    .bind(&user.name)
    .bind(&user.avatar_url)
    .bind(&user.site_url)
    .bind(&user.anilist_token_cipher)
    .bind(&user.anilist_token_nonce)
    .bind(Utc::now())
    .fetch_one(executor)
    .await?)
}

pub async fn create_session(
    executor: impl PgExecutor<'_>, user_id: i64, token_hash: &[u8], device: &str,
) -> Result<(), DbError> {
    sqlx::query("INSERT INTO sessions (user_id, token_hash, device) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(token_hash)
        .bind(device)
        .execute(executor)
        .await?;
    Ok(())
}

/// Dono da sessão ativa com esse hash; também marca o último uso.
pub async fn find_by_session(pool: &PgPool, token_hash: &[u8]) -> Result<Option<User>, DbError> {
    Ok(sqlx::query_as(
        "WITH touched AS (
             UPDATE sessions SET last_used_at = now()
             WHERE token_hash = $1 AND revoked_at IS NULL
             RETURNING user_id
         )
         SELECT users.* FROM users JOIN touched ON touched.user_id = users.id",
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await?)
}

pub async fn revoke_session(pool: &PgPool, token_hash: &[u8]) -> Result<(), DbError> {
    sqlx::query(
        "UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    )
    .bind(token_hash)
    .execute(pool)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::test_support::{user, TestDatabase};

    #[tokio::test]
    async fn teste_upsert_atualiza_o_mesmo_usuario() {
        let Some(db) = TestDatabase::create().await else { return };
        upsert(&db.pool, &user(1)).await.unwrap();
        let mut renamed = user(1);
        renamed.name = "novo".into();
        upsert(&db.pool, &renamed).await.unwrap();

        assert_eq!(count(&db.pool).await.unwrap(), 1);
        assert_eq!(find(&db.pool, 1).await.unwrap().unwrap().name, "novo");
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_sessao_revogada_nao_autentica() {
        let Some(db) = TestDatabase::create().await else { return };
        upsert(&db.pool, &user(1)).await.unwrap();
        create_session(&db.pool, 1, b"hash", "chrome").await.unwrap();

        assert_eq!(find_by_session(&db.pool, b"hash").await.unwrap().unwrap().id, 1);
        assert!(find_by_session(&db.pool, b"outro").await.unwrap().is_none());

        revoke_session(&db.pool, b"hash").await.unwrap();
        assert!(find_by_session(&db.pool, b"hash").await.unwrap().is_none());
        db.drop().await;
    }
}
