mod support;

use anyhow::Result;
use axum::{body::Body, http::Request};
use tower::ServiceExt;

#[tokio::test]
async fn test_health_check_returns_ok() -> Result<()> {
    // O /health responde sem depender do banco
    let app = support::build_test_app();

    let response = app.oneshot(Request::get("/health").body(Body::empty())?).await?;
    assert_eq!(response.status(), 200);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let payload: serde_json::Value = serde_json::from_slice(&body)?;
    assert_eq!(payload["status"], "ok");

    Ok(())
}
