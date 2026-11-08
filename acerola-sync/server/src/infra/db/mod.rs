use std::borrow::Cow;

use sqlx::{
    migrate::{Migration, MigrationType, Migrator},
    PgPool,
};

use crate::infra::error::DbError;

#[cfg(test)]
pub mod test_support;

/// Lista ordenada de migrações, organizada por domínio em `migrations/` (mesmo esquema do
/// acerola-reader). A versão é global e nunca é reaproveitada.
pub fn get_migrations() -> Vec<Migration> {
    let mut migrations = vec![];
    migrations.extend(extension_migrations());
    migrations.extend(user_migrations());
    migrations.extend(media_migrations());
    migrations.extend(entry_migrations());
    migrations.extend(sync_migrations());
    migrations.extend(tracking_migrations());
    // A versão é global: ordena para o Migrator aplicar 6 antes de 7 mesmo vindo de domínios
    // diferentes.
    migrations.sort_by_key(|migration| migration.version);
    migrations
}

fn extension_migrations() -> Vec<Migration> {
    vec![migration(
        1,
        "enable_pg_trgm",
        include_str!("./migrations/extensions/001_enable_pg_trgm.sql"),
    )]
}

fn user_migrations() -> Vec<Migration> {
    vec![migration(2, "create_users", include_str!("./migrations/users/002_create_users.sql"))]
}

fn media_migrations() -> Vec<Migration> {
    vec![
        migration(3, "create_media", include_str!("./migrations/media/003_create_media.sql")),
        migration(
            8,
            "media_list_filters",
            include_str!("./migrations/media/008_media_list_filters.sql"),
        ),
        migration(9, "media_details", include_str!("./migrations/media/009_media_details.sql")),
    ]
}

fn entry_migrations() -> Vec<Migration> {
    vec![migration(
        4,
        "create_entries",
        include_str!("./migrations/entries/004_create_entries.sql"),
    )]
}

fn sync_migrations() -> Vec<Migration> {
    vec![
        migration(5, "create_sync", include_str!("./migrations/sync/005_create_sync.sql")),
        migration(
            7,
            "sync_logs_and_incremental",
            include_str!("./migrations/sync/007_sync_logs_and_incremental.sql"),
        ),
        migration(
            11,
            "full_sync_interval",
            include_str!("./migrations/sync/011_full_sync_interval.sql"),
        ),
    ]
}

fn tracking_migrations() -> Vec<Migration> {
    vec![
        migration(
            6,
            "create_tracking",
            include_str!("./migrations/tracking/006_create_tracking.sql"),
        ),
        migration(
            10,
            "custom_site_search",
            include_str!("./migrations/tracking/010_custom_site_search.sql"),
        ),
    ]
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
