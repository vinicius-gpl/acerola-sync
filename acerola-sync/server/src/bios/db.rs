use std::str::FromStr;

use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool,
};

use super::env::Env;
use crate::infra::{db::run_migrations, error::DbError};

pub async fn setup_database(env: &Env) -> Result<PgPool, DbError> {
    tracing::info!("[Bios::Db] Connecting to Postgres database");

    let connect_options =
        PgConnectOptions::from_str(&env.database_url).map_err(DbError::Internal)?;
    let database_pool = match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        PgPoolOptions::new().max_connections(10).connect_with(statement_options(connect_options)),
    )
    .await
    {
        Ok(Ok(pool_instance)) => pool_instance,
        Ok(Err(connection_error)) => {
            tracing::error!(
                "[Bios::Db] Failed to connect to Postgres database: {:?}",
                connection_error
            );
            return Err(DbError::Internal(connection_error));
        },
        Err(timeout_error) => {
            tracing::error!("[Bios::Db] Timeout waiting for PgPool::connect: {:?}", timeout_error);
            return Err(DbError::Timeout);
        },
    };

    run_migrations(&database_pool).await?;

    tracing::info!("[Bios::Db] Database initialized successfully");

    Ok(database_pool)
}

/// Sem cache de statements preparados. Atrás de um pooler (pgbouncer em modo transação), o
/// statement preparado fica na conexão do pooler e sobrevive ao restart do server: depois de
/// uma migration que muda colunas, o Postgres recusa o plano antigo com "cached plan must not
/// change result type" e toda rota afetada devolve 500. O custo de reparsear é desprezível
/// para o volume de um usuário.
pub fn statement_options(options: PgConnectOptions) -> PgConnectOptions {
    options.statement_cache_capacity(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn teste_conexao_sem_cache_de_statements() {
        let options = PgConnectOptions::from_str("postgres://u:p@localhost/db").unwrap();
        // Reconfigurar não pode falhar e deve manter host/banco.
        let options = statement_options(options);
        assert_eq!(options.get_host(), "localhost");
        assert_eq!(options.get_database(), Some("db"));
    }
}
