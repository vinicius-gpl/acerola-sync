use crate::infra::error::EnvError;

/// Variáveis de ambiente lidas na inicialização. Ver `server/.env.example`.
#[derive(Debug, Clone)]
pub struct Env {
    pub database_url: String,
    pub server_port: u16,
}

impl Env {
    pub fn from_env() -> Result<Self, EnvError> {
        let database_url =
            std::env::var("DATABASE_URL").map_err(|_| EnvError::Missing("DATABASE_URL"))?;

        let server_port = match std::env::var("SERVER_PORT") {
            Ok(value) => value.parse::<u16>().map_err(|_| EnvError::Invalid("SERVER_PORT"))?,
            Err(_) => 3010,
        };

        Ok(Self { database_url, server_port })
    }
}
