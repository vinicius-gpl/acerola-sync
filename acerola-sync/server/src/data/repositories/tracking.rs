use sqlx::{PgExecutor, PgPool};

use crate::{
    data::models::tracking::{CustomSite, HistoryItem, LastVisit, SiteMapping},
    infra::error::DbError,
};

pub async fn find_mapping(
    pool: &PgPool, user_id: i64, site: &str, identifier: &str,
) -> Result<Option<SiteMapping>, DbError> {
    Ok(sqlx::query_as(
        "SELECT * FROM site_mappings WHERE user_id = $1 AND site = $2 AND identifier = $3",
    )
    .bind(user_id)
    .bind(site)
    .bind(identifier)
    .fetch_optional(pool)
    .await?)
}

/// Grava o mapeamento. Um automático nunca sobrescreve uma correção manual.
pub async fn save_mapping(
    pool: &PgPool, user_id: i64, site: &str, identifier: &str, media_id: i64, title: &str,
    source: &str,
) -> Result<SiteMapping, DbError> {
    Ok(sqlx::query_as(
        "INSERT INTO site_mappings (user_id, site, identifier, media_id, title, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, site, identifier) DO UPDATE SET
             media_id = CASE WHEN site_mappings.source = 'MANUAL' AND EXCLUDED.source = 'AUTO'
                             THEN site_mappings.media_id ELSE EXCLUDED.media_id END,
             source = CASE WHEN site_mappings.source = 'MANUAL' THEN 'MANUAL' ELSE EXCLUDED.source END,
             title = EXCLUDED.title,
             updated_at = now()
         RETURNING *",
    )
    .bind(user_id)
    .bind(site)
    .bind(identifier)
    .bind(media_id)
    .bind(title)
    .bind(source)
    .fetch_one(pool)
    .await?)
}

pub async fn delete_mapping(
    pool: &PgPool, user_id: i64, site: &str, identifier: &str,
) -> Result<(), DbError> {
    sqlx::query("DELETE FROM site_mappings WHERE user_id = $1 AND site = $2 AND identifier = $3")
        .bind(user_id)
        .bind(site)
        .bind(identifier)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn insert_history(
    executor: impl PgExecutor<'_>, user_id: i64, media_id: i64, progress: i32, previous: i32,
    source: &str, url: Option<&str>,
) -> Result<(), DbError> {
    sqlx::query(
        "INSERT INTO history (user_id, media_id, progress, previous, source, url)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(user_id)
    .bind(media_id)
    .bind(progress)
    .bind(previous)
    .bind(source)
    .bind(url)
    .execute(executor)
    .await?;
    Ok(())
}

pub async fn recent_history(
    pool: &PgPool, user_id: i64, limit: i64,
) -> Result<Vec<HistoryItem>, DbError> {
    Ok(sqlx::query_as(
        "SELECT history.id, history.media_id, history.progress, history.previous, history.source,
                history.url, history.created_at, media.title_user_preferred AS title,
                media.cover_url, media.media_type
         FROM history JOIN media ON media.id = history.media_id
         WHERE history.user_id = $1
         ORDER BY history.created_at DESC
         LIMIT $2",
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn list_custom_sites(pool: &PgPool, user_id: i64) -> Result<Vec<CustomSite>, DbError> {
    Ok(sqlx::query_as("SELECT * FROM custom_sites WHERE user_id = $1 ORDER BY name")
        .bind(user_id)
        .fetch_all(pool)
        .await?)
}

pub struct CustomSiteInput<'a> {
    pub name: &'a str,
    pub media_type: &'a str,
    pub match_pattern: &'a str,
    pub url_pattern: &'a str,
    pub title_selector: Option<&'a str>,
    pub enabled: bool,
    pub search_url: Option<&'a str>,
}

pub async fn insert_custom_site(
    pool: &PgPool, user_id: i64, input: &CustomSiteInput<'_>,
) -> Result<CustomSite, DbError> {
    Ok(sqlx::query_as(
        "INSERT INTO custom_sites (user_id, name, media_type, match_pattern, url_pattern, title_selector, enabled, search_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(user_id)
    .bind(input.name)
    .bind(input.media_type)
    .bind(input.match_pattern)
    .bind(input.url_pattern)
    .bind(input.title_selector)
    .bind(input.enabled)
    .bind(input.search_url)
    .fetch_one(pool)
    .await?)
}

pub async fn update_custom_site(
    pool: &PgPool, user_id: i64, id: i64, input: &CustomSiteInput<'_>,
) -> Result<CustomSite, DbError> {
    Ok(sqlx::query_as(
        "UPDATE custom_sites SET name = $3, media_type = $4, match_pattern = $5, url_pattern = $6,
                                 title_selector = $7, enabled = $8, search_url = $9,
                                 updated_at = now()
         WHERE user_id = $1 AND id = $2 RETURNING *",
    )
    .bind(user_id)
    .bind(id)
    .bind(input.name)
    .bind(input.media_type)
    .bind(input.match_pattern)
    .bind(input.url_pattern)
    .bind(input.title_selector)
    .bind(input.enabled)
    .bind(input.search_url)
    .fetch_one(pool)
    .await?)
}

/// A página mais recente de cada site (com URL) em que a obra foi marcada.
pub async fn last_visits(
    pool: &PgPool, user_id: i64, media_id: i64,
) -> Result<Vec<LastVisit>, DbError> {
    Ok(sqlx::query_as(
        "SELECT * FROM (
             SELECT DISTINCT ON (source) source, url, progress, created_at
             FROM history
             WHERE user_id = $1 AND media_id = $2 AND url IS NOT NULL
             ORDER BY source, created_at DESC
         ) visits ORDER BY created_at DESC",
    )
    .bind(user_id)
    .bind(media_id)
    .fetch_all(pool)
    .await?)
}

pub async fn delete_custom_site(pool: &PgPool, user_id: i64, id: i64) -> Result<(), DbError> {
    sqlx::query("DELETE FROM custom_sites WHERE user_id = $1 AND id = $2")
        .bind(user_id)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        data::repositories::{media as media_repository, users as user_repository},
        infra::db::test_support::{media, user, TestDatabase},
    };

    async fn seed(pool: &PgPool) {
        user_repository::upsert(pool, &user(1)).await.unwrap();
        media_repository::upsert(pool, &media(1, "MANGA", "Chainsaw Man")).await.unwrap();
        media_repository::upsert(pool, &media(2, "MANGA", "Chainsaw Man Part 2")).await.unwrap();
    }

    #[tokio::test]
    async fn teste_mapeamento_automatico_nao_sobrescreve_manual() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;

        save_mapping(&db.pool, 1, "sakura", "csm", 2, "CSM", "MANUAL").await.unwrap();
        let after_auto =
            save_mapping(&db.pool, 1, "sakura", "csm", 1, "CSM", "AUTO").await.unwrap();
        assert_eq!(after_auto.media_id, 2);
        assert_eq!(after_auto.source, "MANUAL");

        delete_mapping(&db.pool, 1, "sakura", "csm").await.unwrap();
        assert!(find_mapping(&db.pool, 1, "sakura", "csm").await.unwrap().is_none());
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_historico_traz_titulo_mais_recente_primeiro() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;
        insert_history(&db.pool, 1, 1, 10, 9, "sakura", None).await.unwrap();
        insert_history(&db.pool, 1, 1, 11, 10, "sakura", Some("https://x")).await.unwrap();

        let items = recent_history(&db.pool, 1, 10).await.unwrap();
        assert_eq!(items[0].progress, 11);
        assert_eq!(items[0].title, "Chainsaw Man");
        assert_eq!(recent_history(&db.pool, 1, 1).await.unwrap().len(), 1);
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_ultima_pagina_de_cada_site() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;
        insert_history(&db.pool, 1, 1, 10, 9, "sakura", None).await.unwrap();
        insert_history(&db.pool, 1, 1, 11, 10, "sakura", Some("https://x/11")).await.unwrap();
        insert_history(&db.pool, 1, 1, 12, 11, "sakura", Some("https://x/12")).await.unwrap();
        insert_history(&db.pool, 1, 1, 13, 12, "custom:9", Some("https://y/13")).await.unwrap();

        let visits = last_visits(&db.pool, 1, 1).await.unwrap();
        let urls: Vec<_> = visits.iter().map(|visit| visit.url.as_str()).collect();
        assert_eq!(urls, ["https://y/13", "https://x/12"]);
        assert!(last_visits(&db.pool, 1, 999).await.unwrap().is_empty());
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_crud_de_site_personalizado() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;
        let input = CustomSiteInput {
            name: "Leitor",
            media_type: "MANGA",
            match_pattern: "https://leitor.exemplo.com/*",
            url_pattern: r"/obra/(?<id>[^/]+)/(?<progress>\d+)",
            title_selector: None,
            enabled: true,
            search_url: Some("https://leitor.exemplo.com/busca?q={title}"),
        };
        let created = insert_custom_site(&db.pool, 1, &input).await.unwrap();
        assert_eq!(created.search_url.as_deref(), input.search_url);
        let disabled = CustomSiteInput { enabled: false, ..input };
        let updated = update_custom_site(&db.pool, 1, created.id, &disabled).await.unwrap();
        assert!(!updated.enabled);

        delete_custom_site(&db.pool, 1, created.id).await.unwrap();
        assert!(list_custom_sites(&db.pool, 1).await.unwrap().is_empty());
        db.drop().await;
    }
}
