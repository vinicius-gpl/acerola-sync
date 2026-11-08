use serde::{Deserialize, Serialize};

use crate::data::models::{entry::Entry, media::Media, tracking::LastVisit};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub q: String,
    pub media_type: Option<String>,
    #[serde(default)]
    pub remote: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDetailPayload {
    pub media: Media,
    pub entry: Option<Entry>,
    /// Última página de cada site em que a obra foi marcada.
    pub visits: Vec<LastVisit>,
}
