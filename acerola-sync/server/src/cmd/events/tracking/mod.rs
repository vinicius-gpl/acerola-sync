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
    /// Match pattern da extensão (`https://site.com/*`).
    pub match_pattern: String,
    /// Regex com os grupos `id` e `progress` (e `title`, opcional).
    pub url_pattern: String,
    pub title_selector: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Busca do site, com `{title}` no lugar do título.
    #[serde(default)]
    pub search_url: Option<String>,
    /// De onde sai o número: `url` (padrão), `title` ou `selector`.
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
