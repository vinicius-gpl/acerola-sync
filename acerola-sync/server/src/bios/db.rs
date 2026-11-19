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

/// No prepared statement cache. Behind a pooler (pgbouncer in transaction mode), the prepared
/// statement stays on the pooler connection and survives a server restart: after a migration
/// that changes columns, Postgres rejects the old plan with "cached plan must not change result
/// type" and every affected route returns 500. The reparse cost is negligible for a single
/// user's volume.
pub fn statement_options(options: PgConnectOptions) -> PgConnectOptions {
    options.statement_cache_capacity(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn teste_conexao_sem_cache_de_statements() {
        let options = PgConnectOptions::from_str("postgres://u:p@localhost/db").unwrap();
        // Reconfiguring must not fail and must keep host/database.
        let options = statement_options(options);
        assert_eq!(options.get_host(), "localhost");
        assert_eq!(options.get_database(), Some("db"));
    }
}
