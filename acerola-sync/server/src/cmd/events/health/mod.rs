use serde::Serialize;

/// `/health` response, used by Docker and the proxy to know whether the server is up.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthPayload {
    pub status: String,
    pub version: String,
}
