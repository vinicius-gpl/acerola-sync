#![allow(dead_code)]

pub mod bios;
pub mod cmd;
pub mod core;
pub mod data;
pub mod infra;

pub async fn run() {
    bios::setup_tracing();

    let env = bios::env::Env::from_env().expect("Erro ao ler as variáveis de ambiente");
    let database_pool =
        bios::db::setup_database(&env).await.expect("Erro ao conectar no banco de dados");

    let app = bios::build(bios::AppState { database_pool });
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", env.server_port))
        .await
        .expect("Erro ao abrir a porta do servidor");

    tracing::info!("[Bios] Listening on port {}", env.server_port);

    // `with_graceful_shutdown` só pra fechar as conexões abertas antes do processo terminar —
    // ver `bios::shutdown_signal`.
    axum::serve(listener, app)
        .with_graceful_shutdown(bios::shutdown_signal())
        .await
        .expect("Erro ao rodar o servidor");
}
