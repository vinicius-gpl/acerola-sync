use thiserror::Error;

pub mod db;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Record not found.")]
    NotFound,

    #[error("Unique constraint violation.")]
    UniqueViolation,

    #[error("Foreign key constraint violation.")]
    ForeignKeyViolation,

    #[error("Check constraint violation.")]
    CheckViolation,

    #[error("Timeout while connecting to the database.")]
    Timeout,

    #[error("Migration failed: {0}")]
    Migration(sqlx::migrate::MigrateError),

    #[error("Internal database error: {0}")]
    Internal(sqlx::Error),
}

#[derive(Debug, Error)]
pub enum EnvError {
    #[error("Missing environment variable: {0}")]
    Missing(&'static str),

    #[error("Invalid environment variable: {0}")]
    Invalid(&'static str),
}
