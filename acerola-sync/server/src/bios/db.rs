use sqlx::{postgres::PgPoolOptions, PgPool};

use super::env::Env;
use crate::infra::{db::run_migrations, error::DbError};

pub async fn setup_database(env: &Env) -> Result<PgPool, DbError> {
    tracing::info!("[Bios::Db] Connecting to Postgres database");

    let database_pool = match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        PgPoolOptions::new().max_connections(10).connect(&env.database_url),
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
