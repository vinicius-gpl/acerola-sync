use axum::Json;

use crate::cmd::events::health::HealthPayload;

pub async fn health_check() -> Json<HealthPayload> {
    Json(HealthPayload { status: "ok".to_string(), version: env!("CARGO_PKG_VERSION").to_string() })
}
