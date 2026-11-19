use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MappingRequest {
    pub site: String,
    pub identifier: String,
    pub media_id: i64,
    #[serde(default)]
    pub title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MappingKeyQuery {
    pub site: String,
    pub identifier: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSiteRequest {
    pub name: String,
    pub media_type: String,
    /// Extension match pattern (`https://site.com/*`).
    pub match_pattern: String,
    /// Regex with the `id` and `progress` groups (and an optional `title`).
    pub url_pattern: String,
    pub title_selector: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Site search, with `{title}` in place of the title.
    #[serde(default)]
    pub search_url: Option<String>,
    /// Where the number comes from: `url` (default), `title` or `selector`.
    #[serde(default = "default_progress_source")]
    pub progress_source: String,
    #[serde(default)]
    pub progress_selector: Option<String>,
    #[serde(default)]
    pub progress_pattern: Option<String>,
}

fn default_progress_source() -> String {
    "url".into()
}

fn default_enabled() -> bool {
    true
}
