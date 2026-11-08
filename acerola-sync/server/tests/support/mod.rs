#![allow(dead_code)]

use std::time::Duration;

use acerola_sync_lib::{
    bios::{self, AppState},
    infra::{anilist::AnilistClient, db::run_migrations},
};
use axum::{
    body::Body,
    http::{header, Method, Request},
    Router,
};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, Connection, PgConnection, PgPool};
use tower::ServiceExt;
use wiremock::MockServer;

pub const ENCRYPTION_KEY: [u8; 32] = [42u8; 32];
pub const VIEWER_ID: i64 = 5001;

/// Router com um pool preguiçoso: não conecta enquanto nenhuma rota tocar no banco.
pub fn build_test_app() -> Router {
    let database_pool = PgPoolOptions::new()
        .connect_lazy("postgres://acerola:acerola@localhost:5432/acerola_sync_test")
        .expect("URL de banco de teste inválida");

    bios::build(AppState::new(
        database_pool,
        AnilistClient::new("http://127.0.0.1:9"),
        ENCRYPTION_KEY,
        "12345".to_string(),
        None,
    ))
}

/// Banco novo e vazio por teste, criado a partir de `TEST_DATABASE_URL` (um Postgres onde o
/// usuário pode criar bancos). Sem a variável, o teste é pulado.
pub struct TestDb {
    pub pool: PgPool,
    admin_url: String,
    name: String,
}

impl TestDb {
    pub async fn create() -> Option<Self> {
        let Ok(admin_url) = std::env::var("TEST_DATABASE_URL") else {
            eprintln!("TEST_DATABASE_URL not set; skipping database test");
            return None;
        };
        let name = format!("acerola_test_{}", rand_suffix());
        let mut admin = PgConnection::connect(&admin_url).await.expect("admin connection");
        sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
            .execute(&mut admin)
            .await
            .unwrap();

        let url = replace_database(&admin_url, &name);
        let pool = PgPoolOptions::new().max_connections(5).connect(&url).await.unwrap();
        run_migrations(&pool).await.unwrap();
        Some(Self { pool, admin_url, name })
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

fn rand_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    format!("{}_{}", std::process::id(), nanos)
}

fn replace_database(url: &str, name: &str) -> String {
    let (base, _) = url.rsplit_once('/').expect("URL com nome de banco");
    format!("{base}/{name}")
}

pub fn app_with(pool: PgPool, anilist: &MockServer) -> Router {
    bios::build(AppState::new(
        pool,
        AnilistClient::with_spacing(anilist.uri(), Duration::ZERO),
        ENCRYPTION_KEY,
        "12345".to_string(),
        None,
    ))
}

pub async fn call(
    app: &Router, method: Method, path: &str, token: Option<&str>, body: Option<Value>,
) -> (u16, Value) {
    let mut builder = Request::builder().method(method).uri(path);
    if let Some(token) = token {
        builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }
    let request = match body {
        Some(body) => builder
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
            .unwrap(),
        None => builder.body(Body::empty()).unwrap(),
    };

    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status().as_u16();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value =
        if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).unwrap() };
    (status, value)
}

pub fn media(id: i64, media_type: &str, title: &str, total: Option<i32>) -> Value {
    json!({
        "id": id, "idMal": null, "type": media_type, "format": "TV", "status": "FINISHED",
        "episodes": if media_type == "ANIME" { json!(total) } else { Value::Null },
        "chapters": if media_type == "MANGA" { json!(total) } else { Value::Null },
        "volumes": null, "duration": 24, "season": null, "seasonYear": 2024,
        "averageScore": 90, "genres": ["Adventure"], "synonyms": [], "siteUrl": null,
        "isAdult": false, "countryOfOrigin": "JP", "updatedAt": 1_700_000_000,
        "description": null,
        "title": { "romaji": title, "english": null, "native": null, "userPreferred": title },
        "coverImage": { "extraLarge": format!("https://img.example/{id}.jpg"), "large": null, "color": "#ffaa00" },
        "bannerImage": null, "nextAiringEpisode": null
    })
}

pub fn entry(id: i64, status: &str, progress: i32, media: Value) -> Value {
    json!({
        "id": id, "status": status, "progress": progress, "progressVolumes": 0, "score": 80.0,
        "repeat": 0, "private": false, "notes": null, "updatedAt": 1_700_000_000,
        "startedAt": { "year": 2024, "month": 1, "day": 2 },
        "completedAt": { "year": null, "month": null, "day": null },
        "media": media
    })
}

pub fn collection(entries: Vec<Value>) -> Value {
    json!({ "data": { "MediaListCollection": { "hasNextChunk": false, "lists": [{ "entries": entries }] } } })
}

pub fn viewer() -> Value {
    json!({ "data": { "Viewer": { "id": VIEWER_ID, "name": "vinicius", "siteUrl": null, "avatar": { "large": null } } } })
}

/// Dispara um sync (`POST /sync`, que responde 202 na hora) e espera ele terminar pelos logs.
pub async fn run_sync(app: &Router, token: &str, full: bool) -> Value {
    let path = if full { "/sync?full=true" } else { "/sync" };
    let (status, run) = call(app, Method::POST, path, Some(token), None).await;
    assert_eq!(status, 202, "{run}");
    let id = run["id"].as_i64().unwrap();

    for _ in 0..100 {
        let (_, body) =
            call(app, Method::GET, &format!("/sync/runs/{id}/logs"), Some(token), None).await;
        if body["run"]["status"] != "RUNNING" {
            return body;
        }
        tokio::time::sleep(Duration::from_millis(30)).await;
    }
    panic!("sync never finished");
}

/// Espera o sync disparado pelo primeiro login terminar.
pub async fn wait_sync_idle(app: &Router, token: &str) {
    for _ in 0..100 {
        let (_, status) = call(app, Method::GET, "/sync/status", Some(token), None).await;
        if status["running"] == false && !status["runs"].as_array().unwrap().is_empty() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("sync never finished");
}
