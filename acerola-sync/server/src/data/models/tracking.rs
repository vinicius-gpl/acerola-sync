use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteMapping {
    pub user_id: i64,
    pub site: String,
    pub identifier: String,
    pub media_id: i64,
    pub title: String,
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Última página de cada site em que a obra foi marcada: o "continuar de onde parou".
#[derive(Debug, Clone, FromRow, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LastVisit {
    pub source: String,
    pub url: String,
    pub progress: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: i64,
    pub media_id: i64,
    pub progress: i32,
    pub previous: i32,
    pub source: String,
    pub url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub title: String,
    pub cover_url: Option<String>,
    pub media_type: String,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSite {
    #[serde(serialize_with = "crate::cmd::events::shared::serialize_i64_as_string")]
    pub id: i64,
    #[serde(skip)]
    pub user_id: i64,
    pub name: String,
    pub media_type: String,
    pub match_pattern: String,
    pub url_pattern: String,
    pub title_selector: Option<String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    /// Busca do site com `{title}` no lugar do título.
    pub search_url: Option<String>,
    pub updated_at: DateTime<Utc>,
    /// De onde sai o número: `url`, `title` (título da página) ou `selector` (elemento).
    pub progress_source: String,
    pub progress_selector: Option<String>,
    /// Regex que tira o número do texto lido (grupo `progress`, o primeiro grupo ou o todo).
    pub progress_pattern: Option<String>,
}
