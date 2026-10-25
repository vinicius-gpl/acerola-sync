use std::borrow::Cow;

use sqlx::{
    migrate::{Migration, MigrationType, Migrator},
    PgPool,
};

use crate::infra::error::DbError;

/// Lista ordenada de migrações, organizada por domínio em `migrations/` (mesmo esquema do
/// acerola-reader). A versão é global e nunca é reaproveitada.
pub fn get_migrations() -> Vec<Migration> {
    let mut migrations = vec![];
    migrations.extend(extension_migrations());
    migrations
}

fn extension_migrations() -> Vec<Migration> {
    vec![migration(
        1,
        "enable_pg_trgm",
        include_str!("./migrations/extensions/001_enable_pg_trgm.sql"),
    )]
}

fn migration(version: i64, description: &'static str, sql: &'static str) -> Migration {
    Migration::new(
        version,
        Cow::Borrowed(description),
        MigrationType::Simple,
        Cow::Borrowed(sql),
        false,
    )
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), DbError> {
    let migrator = Migrator { migrations: Cow::Owned(get_migrations()), ..Migrator::DEFAULT };
    migrator.run(pool).await?;
    Ok(())
}
