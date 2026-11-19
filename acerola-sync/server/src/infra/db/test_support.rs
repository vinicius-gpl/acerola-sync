//! Test database for the repositories' and services' `mod tests` (the equivalent of
//! acerola-reader's `setup_test_db`, but on Postgres).
//!
//! Each test creates a new database from `TEST_DATABASE_URL` (a Postgres where the user can
//! create databases), runs the migrations and drops the database at the end. Without the
//! variable, the test warns and passes without running, so `cargo test` keeps working without Postgres.

use chrono::Utc;
use sqlx::{postgres::PgPoolOptions, Connection, PgConnection, PgPool};

use super::run_migrations;
use crate::data::models::{media::Media, user::User};

pub struct TestDatabase {
    pub pool: PgPool,
    admin_url: String,
    name: String,
}

impl TestDatabase {
    pub async fn create() -> Option<Self> {
        let Ok(admin_url) = std::env::var("TEST_DATABASE_URL") else {
            eprintln!("TEST_DATABASE_URL não definida; teste de banco pulado");
            return None;
        };
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("relógio válido")
            .as_nanos();
        let name = format!("acerola_unit_{}_{}", std::process::id(), nanos);

        let mut admin = PgConnection::connect(&admin_url).await.expect("conexão admin");
        sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
            .execute(&mut admin)
            .await
            .unwrap();

        let (base, _) = admin_url.rsplit_once('/').expect("URL com nome de banco");
        let pool = PgPoolOptions::new()
            .max_connections(3)
            .connect(&format!("{base}/{name}"))
            .await
            .expect("conexão com o banco de teste");
        run_migrations(&pool).await.expect("migrations");
        Some(Self { pool, admin_url, name })
    }

    /// Single-connection pool on the same database: the prepared query cache lives in one place,
    /// like a connection reused by the pooler in production.
    pub async fn single_connection_pool(&self) -> PgPool {
        let (base, _) = self.admin_url.rsplit_once('/').expect("URL com nome de banco");
        PgPoolOptions::new()
            .max_connections(1)
            .connect(&format!("{base}/{}", self.name))
            .await
            .expect("conexão com o banco de teste")
    }

    pub async fn drop(self) {
        self.pool.close().await;
        let mut admin = PgConnection::connect(&self.admin_url).await.unwrap();
        sqlx::query(sqlx::AssertSqlSafe(format!(
            "DROP DATABASE IF EXISTS {} WITH (FORCE)",
            self.name
        )))
        .execute(&mut admin)
        .await
        .unwrap();
    }
}

pub fn user(id: i64) -> User {
    User {
        id,
        name: format!("user-{id}"),
        avatar_url: None,
        site_url: None,
        anilist_token_cipher: vec![1, 2, 3],
        anilist_token_nonce: vec![0; 12],
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

pub fn media(id: i64, media_type: &str, title: &str) -> Media {
    Media {
        id,
        id_mal: None,
        media_type: media_type.to_string(),
        format: Some("TV".into()),
        status: Some("FINISHED".into()),
        title_romaji: Some(title.to_string()),
        title_english: None,
        title_native: None,
        title_user_preferred: title.to_string(),
        synonyms: vec![],
        description: None,
        episodes: Some(12),
        chapters: None,
        volumes: None,
        duration: Some(24),
        season: None,
        season_year: Some(2024),
        start_year: Some(2024),
        average_score: None,
        genres: vec![],
        is_adult: false,
        country_of_origin: None,
        cover_url: None,
        cover_color: None,
        banner_url: None,
        site_url: None,
        next_airing_episode: None,
        next_airing_at: None,
        anilist_updated_at: None,
        synced_at: Utc::now(),
        search_text: title.to_lowercase(),
        details_synced_at: None,
        source: None,
        studios: vec![],
        start_date: None,
        end_date: None,
        external_links: sqlx::types::Json(vec![]),
        relations: sqlx::types::Json(vec![]),
    }
}
