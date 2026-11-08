use super::DbError;

impl From<sqlx::Error> for DbError {
    fn from(err: sqlx::Error) -> Self {
        if let sqlx::Error::RowNotFound = err {
            log::debug!("[DbError] RowNotFound → NotFound.");
            return DbError::NotFound;
        }

        if let sqlx::Error::Database(ref db) = err {
            if db.is_unique_violation() {
                log::debug!("[DbError] UNIQUE constraint violated → UniqueViolation.");
                return DbError::UniqueViolation;
            }

            if db.is_foreign_key_violation() {
                log::warn!("[DbError] FOREIGN KEY constraint violated → ForeignKeyViolation.");
                return DbError::ForeignKeyViolation;
            }

            if db.is_check_violation() {
                log::warn!("[DbError] CHECK constraint violated → CheckViolation.");
                return DbError::CheckViolation;
            }
        }

        log::error!("[DbError] Unmapped error → Internal: {:?}", err);
        DbError::Internal(err)
    }
}

impl From<sqlx::migrate::MigrateError> for DbError {
    fn from(err: sqlx::migrate::MigrateError) -> Self {
        log::error!("[DbError] Migration failed: {:?}", err);
        DbError::Migration(err)
    }
}
