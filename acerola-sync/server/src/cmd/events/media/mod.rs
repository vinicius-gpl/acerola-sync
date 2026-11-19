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
    /// Last page of each site where the media was marked.
    pub visits: Vec<LastVisit>,
}
