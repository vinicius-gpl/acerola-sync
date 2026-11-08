use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
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

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("Failed to encrypt the value.")]
    Encrypt,

    #[error("Failed to decrypt the value.")]
    Decrypt,
}

#[derive(Debug, Error)]
pub enum AnilistError {
    #[error("Network error talking to AniList: {0}")]
    Network(#[from] reqwest::Error),

    #[error("AniList rate limit reached; retry in {retry_after_secs}s.")]
    RateLimited { retry_after_secs: u64 },

    #[error("The AniList token was rejected.")]
    Unauthorized,

    #[error("AniList answered {status}: {message}")]
    Http { status: u16, message: String },

    #[error("AniList returned an error: {0}")]
    GraphQl(String),

    #[error("Unexpected AniList response: {0}")]
    Decode(String),
}

impl AnilistError {
    /// Falha passageira: vale gravar localmente como pendente e reenviar depois.
    pub fn is_transient(&self) -> bool {
        match self {
            AnilistError::Network(_) | AnilistError::RateLimited { .. } => true,
            AnilistError::Http { status, .. } => *status >= 500,
            _ => false,
        }
    }
}

/// Erro devolvido pelas rotas. O corpo segue o `ErrorPayload` da extensão.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Missing or invalid session.")]
    Unauthorized,

    #[error("{0}")]
    Forbidden(String),

    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Conflict(String),

    #[error(transparent)]
    Anilist(#[from] AnilistError),

    #[error(transparent)]
    Db(#[from] DbError),

    #[error(transparent)]
    Crypto(#[from] CryptoError),
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::Db(DbError::from(err))
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorBody {
    error_type: &'static str,
    message: String,
}

impl AppError {
    fn status_and_type(&self) -> (StatusCode, &'static str) {
        match self {
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, "forbidden"),
            AppError::NotFound(_) | AppError::Db(DbError::NotFound) => {
                (StatusCode::NOT_FOUND, "not_found")
            },
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            AppError::Anilist(AnilistError::Unauthorized) => {
                (StatusCode::UNAUTHORIZED, "anilist_unauthorized")
            },
            AppError::Anilist(AnilistError::RateLimited { .. }) => {
                (StatusCode::SERVICE_UNAVAILABLE, "anilist_rate_limited")
            },
            AppError::Anilist(_) => (StatusCode::BAD_GATEWAY, "anilist_error"),
            AppError::Db(_) | AppError::Crypto(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal")
            },
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_type) = self.status_and_type();

        // Detalhe interno (SQL, chave) fica no log, nunca no corpo da resposta.
        let message = if status == StatusCode::INTERNAL_SERVER_ERROR {
            tracing::error!("[AppError] {:?}", self);
            "Internal server error.".to_string()
        } else {
            self.to_string()
        };

        (status, Json(ErrorBody { error_type, message })).into_response()
    }
}
