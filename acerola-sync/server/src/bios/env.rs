use base64::{engine::general_purpose::STANDARD, Engine};

use crate::infra::{anilist::client::DEFAULT_API_URL, error::EnvError};

/// Variáveis de ambiente lidas na inicialização. Ver `server/.env.example`.
#[derive(Debug, Clone)]
pub struct Env {
    pub database_url: String,
    pub server_port: u16,
    /// Chave AES-256 (32 bytes) que criptografa o token do AniList no banco.
    pub encryption_key: [u8; 32],
    pub anilist_api_url: String,
    /// Client ID do app cadastrado no AniList (Settings → Developer). A extensão busca em
    /// `/auth/config` para montar o OAuth.
    pub anilist_client_id: String,
    /// Trava a instância num usuário do AniList. Sem ela, o primeiro login vira o dono.
    pub allowed_anilist_user_id: Option<i64>,
}

impl Env {
    pub fn from_env() -> Result<Self, EnvError> {
        let database_url =
            std::env::var("DATABASE_URL").map_err(|_| EnvError::Missing("DATABASE_URL"))?;

        let server_port = match std::env::var("SERVER_PORT") {
            Ok(value) => value.parse::<u16>().map_err(|_| EnvError::Invalid("SERVER_PORT"))?,
            Err(_) => 3010,
        };

        let encryption_key = std::env::var("ENCRYPTION_KEY")
            .map_err(|_| EnvError::Missing("ENCRYPTION_KEY"))
            .and_then(|value| parse_encryption_key(&value))?;

        let anilist_api_url =
            std::env::var("ANILIST_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.to_string());

        let anilist_client_id = std::env::var("ANILIST_CLIENT_ID")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .ok_or(EnvError::Missing("ANILIST_CLIENT_ID"))?;

        let allowed_anilist_user_id = match std::env::var("ALLOWED_ANILIST_USER_ID") {
            Ok(value) if !value.trim().is_empty() => Some(
                value
                    .trim()
                    .parse::<i64>()
                    .map_err(|_| EnvError::Invalid("ALLOWED_ANILIST_USER_ID"))?,
            ),
            _ => None,
        };

        Ok(Self {
            database_url,
            server_port,
            encryption_key,
            anilist_api_url,
            anilist_client_id,
            allowed_anilist_user_id,
        })
    }
}

/// A chave vem em base64 (`openssl rand -base64 32`).
pub fn parse_encryption_key(value: &str) -> Result<[u8; 32], EnvError> {
    STANDARD
        .decode(value.trim())
        .ok()
        .and_then(|bytes| <[u8; 32]>::try_from(bytes).ok())
        .ok_or(EnvError::Invalid("ENCRYPTION_KEY"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_encryption_key_requires_32_bytes() {
        assert!(parse_encryption_key(&STANDARD.encode([1u8; 32])).is_ok());
        assert!(parse_encryption_key(&STANDARD.encode([1u8; 16])).is_err());
        assert!(parse_encryption_key("não é base64").is_err());
    }
}
