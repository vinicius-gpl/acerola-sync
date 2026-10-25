pub mod db;
pub mod env;

use axum::{routing::get, Router};
use sqlx::PgPool;
use tower_http::trace::TraceLayer;

use crate::cmd::features::health as health_cmd;

/// Estado compartilhado entre as rotas (o equivalente ao `app_handle.manage` do Tauri).
#[derive(Clone)]
pub struct AppState {
    pub database_pool: PgPool,
}

pub fn build(state: AppState) -> Router {
    let router = Router::new().route("/health", get(health_cmd::health_check));
    let router = setup_trace(router);

    router.with_state(state)
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
