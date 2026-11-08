pub mod db;
pub mod env;
pub mod state;

use axum::{
    http::{header, Method},
    routing::{get, patch, post, put},
    Router,
};
pub use state::AppState;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::cmd::features::{
    auth as auth_cmd, entries as entries_cmd, health as health_cmd, media as media_cmd,
    sync as sync_cmd, tracking as tracking_cmd,
};

pub fn build(state: AppState) -> Router {
    let router = Router::new()
        .route("/health", get(health_cmd::health_check))
        .route("/auth/config", get(auth_cmd::config))
        .route("/auth/login", post(auth_cmd::login))
        .route("/auth/logout", post(auth_cmd::logout))
        .route("/me", get(auth_cmd::me))
        .route("/entries", get(entries_cmd::list))
        .route("/entries/counts", get(entries_cmd::counts))
        .route("/entries/facets", get(entries_cmd::facets))
        .route("/entries/{media_id}", patch(entries_cmd::update).delete(entries_cmd::delete))
        .route("/entries/{media_id}/sync", post(media_cmd::sync_one))
        .route("/media/search", get(media_cmd::search))
        .route("/media/{media_id}", get(media_cmd::detail))
        .route("/sync", post(sync_cmd::run))
        .route("/sync/status", get(sync_cmd::status))
        .route("/sync/runs/{run_id}/logs", get(sync_cmd::logs))
        .route("/sync/full-interval", put(sync_cmd::save_full_sync_interval))
        .route("/sync/schedule", put(sync_cmd::save_schedule))
        .route("/track/resolve", post(tracking_cmd::resolve))
        .route("/track/progress", post(tracking_cmd::track))
        .route(
            "/track/mapping",
            put(tracking_cmd::save_mapping).delete(tracking_cmd::delete_mapping),
        )
        .route("/history", get(tracking_cmd::history))
        .route(
            "/custom-sites",
            get(tracking_cmd::list_custom_sites).post(tracking_cmd::create_custom_site),
        )
        .route(
            "/custom-sites/{id}",
            put(tracking_cmd::update_custom_site).delete(tracking_cmd::delete_custom_site),
        );
    let router = setup_cors(router);
    let router = setup_trace(router);

    router.with_state(state)
}

/// A extensão chama de `chrome-extension://<id>` (o ID muda por instalação no Firefox), então
/// qualquer origem passa. Quem protege é o token de sessão, não o CORS: não há cookie.
fn setup_cors(router: Router<AppState>) -> Router<AppState> {
    router.layer(
        CorsLayer::new()
            .allow_origin(tower_http::cors::Any)
            .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
            .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]),
    )
}

fn setup_trace(router: Router<AppState>) -> Router<AppState> {
    router.layer(TraceLayer::new_for_http())
}

pub fn setup_tracing() {
    use tracing_subscriber::EnvFilter;

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();
}

/// Espera o Ctrl+C (local) ou o SIGTERM (Docker) para o desligamento gracioso.
pub async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.expect("Erro ao escutar o Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Erro ao escutar o SIGTERM")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("[Bios] Shutdown signal received");
}
