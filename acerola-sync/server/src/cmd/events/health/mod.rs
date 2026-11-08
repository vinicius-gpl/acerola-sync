use serde::Serialize;

/// Resposta do `/health`, usada pelo Docker e pelo proxy para saber se o servidor está de pé.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthPayload {
    pub status: String,
    pub version: String,
}
