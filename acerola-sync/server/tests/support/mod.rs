use acerola_sync_lib::bios::{self, AppState};
use axum::Router;
use sqlx::postgres::PgPoolOptions;

/// Router com um pool preguiçoso: não conecta enquanto nenhuma rota tocar no banco.
pub fn build_test_app() -> Router {
    let database_pool = PgPoolOptions::new()
        .connect_lazy("postgres://acerola:acerola@localhost:5432/acerola_sync_test")
        .expect("URL de banco de teste inválida");

    bios::build(AppState { database_pool })
}
