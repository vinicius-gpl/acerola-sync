use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct GraphQlResponse<T> {
    pub data: Option<T>,
    pub errors: Option<Vec<GraphQlError>>,
}

#[derive(Debug, Deserialize)]
pub struct GraphQlError {
    pub message: String,
    pub status: Option<u16>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Viewer {
    pub id: i64,
    pub name: String,
    pub site_url: Option<String>,
    pub avatar: Option<Avatar>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Avatar {
    pub large: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ViewerData {
    pub viewer: Viewer,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaTitle {
    pub romaji: Option<String>,
    pub english: Option<String>,
    pub native: Option<String>,
    pub user_preferred: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverImage {
    pub extra_large: Option<String>,
    pub large: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiringEpisode {
    pub episode: i32,
    pub airing_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    pub id: i64,
    pub id_mal: Option<i64>,
    #[serde(rename = "type")]
    pub media_type: String,
    pub format: Option<String>,
    pub status: Option<String>,
    pub episodes: Option<i32>,
    pub chapters: Option<i32>,
    pub volumes: Option<i32>,
    pub duration: Option<i32>,
    pub season: Option<String>,
    pub season_year: Option<i32>,
    pub start_date: Option<FuzzyDate>,
    pub average_score: Option<i32>,
    #[serde(default)]
    pub genres: Vec<Option<String>>,
    #[serde(default)]
    pub synonyms: Vec<Option<String>>,
    pub site_url: Option<String>,
    pub is_adult: Option<bool>,
    pub country_of_origin: Option<String>,
    pub updated_at: Option<i64>,
    pub description: Option<String>,
    pub title: MediaTitle,
    pub cover_image: Option<CoverImage>,
    pub banner_image: Option<String>,
    pub next_airing_episode: Option<AiringEpisode>,
    pub source: Option<String>,
    pub end_date: Option<FuzzyDate>,
    pub studios: Option<StudioConnection>,
    #[serde(default)]
    pub external_links: Vec<Option<ExternalLink>>,
    pub relations: Option<RelationConnection>,
    /// Entrada do usuário logado (só na query `media_with_entry`).
    pub media_list_entry: Option<ViewerEntry>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StudioConnection {
    #[serde(default)]
    pub nodes: Vec<Option<Studio>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Studio {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExternalLink {
    pub site: String,
    pub url: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelationConnection {
    #[serde(default)]
    pub edges: Vec<Option<RelationEdge>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationEdge {
    pub relation_type: Option<String>,
    pub node: Option<RelationNode>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationNode {
    pub id: i64,
    #[serde(rename = "type")]
    pub media_type: String,
    pub format: Option<String>,
    pub status: Option<String>,
    pub title: MediaTitle,
    pub cover_image: Option<CoverImage>,
}

/// Os campos de `MediaListEntry` sem a obra (ela é a própria `Media` em volta).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerEntry {
    pub id: i64,
    pub status: String,
    pub progress: Option<i32>,
    pub progress_volumes: Option<i32>,
    pub score: Option<f64>,
    pub repeat: Option<i32>,
    pub private: Option<bool>,
    pub notes: Option<String>,
    pub updated_at: Option<i64>,
    pub started_at: Option<FuzzyDate>,
    pub completed_at: Option<FuzzyDate>,
}

impl ViewerEntry {
    pub fn with_media(self, media: Media) -> MediaListEntry {
        MediaListEntry {
            id: self.id,
            status: self.status,
            progress: self.progress,
            progress_volumes: self.progress_volumes,
            score: self.score,
            repeat: self.repeat,
            private: self.private,
            notes: self.notes,
            updated_at: self.updated_at,
            started_at: self.started_at,
            completed_at: self.completed_at,
            media,
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
pub struct FuzzyDate {
    pub year: Option<i32>,
    pub month: Option<u32>,
    pub day: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaListEntry {
    pub id: i64,
    pub status: String,
    pub progress: Option<i32>,
    pub progress_volumes: Option<i32>,
    pub score: Option<f64>,
    pub repeat: Option<i32>,
    pub private: Option<bool>,
    pub notes: Option<String>,
    pub updated_at: Option<i64>,
    pub started_at: Option<FuzzyDate>,
    pub completed_at: Option<FuzzyDate>,
    pub media: Media,
}

#[derive(Debug, Deserialize)]
pub struct MediaListGroup {
    #[serde(default)]
    pub entries: Vec<Option<MediaListEntry>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaListCollection {
    #[serde(default)]
    pub has_next_chunk: bool,
    #[serde(default)]
    pub lists: Vec<Option<MediaListGroup>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct MediaListCollectionData {
    pub media_list_collection: Option<MediaListCollection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct SaveMediaListEntryData {
    pub save_media_list_entry: MediaListEntry,
}

#[derive(Debug, Deserialize)]
pub struct Deleted {
    pub deleted: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct DeleteMediaListEntryData {
    pub delete_media_list_entry: Option<Deleted>,
}

#[derive(Debug, Deserialize)]
pub struct MediaPage {
    #[serde(default)]
    pub media: Vec<Option<Media>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct SearchMediaData {
    pub page: MediaPage,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageInfo {
    #[serde(default)]
    pub has_next_page: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryPage {
    pub page_info: PageInfo,
    #[serde(default)]
    pub media_list: Vec<Option<MediaListEntry>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct EntryPageData {
    pub page: EntryPage,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiringInfo {
    pub id: i64,
    pub status: Option<String>,
    pub episodes: Option<i32>,
    pub next_airing_episode: Option<AiringEpisode>,
}

#[derive(Debug, Deserialize)]
pub struct AiringPage {
    #[serde(default)]
    pub media: Vec<Option<AiringInfo>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct AiringData {
    pub page: AiringPage,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct MediaByIdData {
    pub media: Option<Media>,
}
