use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::media::{timestamp, Media};
use crate::infra::anilist::types as anilist;

pub const STATUSES: [&str; 6] =
    ["CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED", "REPEATING"];

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub user_id: i64,
    pub media_id: i64,
    pub anilist_entry_id: Option<i64>,
    pub status: String,
    pub progress: i32,
    pub progress_volumes: i32,
    pub score: i32,
    pub repeat: i32,
    pub private: bool,
    pub notes: Option<String>,
    pub started_at: Option<NaiveDate>,
    pub completed_at: Option<NaiveDate>,
    pub anilist_updated_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    pub dirty: bool,
    pub push_attempts: i32,
    pub last_push_error: Option<String>,
}

/// List entry with its media, the way the extension consumes it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryWithMedia {
    #[serde(flatten)]
    pub entry: Entry,
    pub media: Media,
}

/// How many entries are in each status, per type: feeds the list tabs.
#[derive(Debug, Clone, FromRow, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntryCount {
    pub media_type: String,
    pub status: String,
    pub count: i64,
}

/// What exists in the list to filter by.
#[derive(Debug, Clone, Serialize, FromRow, PartialEq, Eq)]
pub struct EntryFacets {
    pub genres: Vec<String>,
    pub formats: Vec<String>,
    pub years: Vec<i32>,
}

/// Fields that can change in an edit. `None` = leave as is.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryPatch {
    pub status: Option<String>,
    pub progress: Option<i32>,
    pub progress_volumes: Option<i32>,
    pub score: Option<i32>,
    pub notes: Option<String>,
    pub private: Option<bool>,
    pub started_at: Option<NaiveDate>,
    pub completed_at: Option<NaiveDate>,
}

pub fn fuzzy_to_date(date: Option<anilist::FuzzyDate>) -> Option<NaiveDate> {
    let date = date?;
    NaiveDate::from_ymd_opt(date.year?, date.month?, date.day?)
}

impl Entry {
    pub fn from_anilist(user_id: i64, entry: &anilist::MediaListEntry) -> Self {
        Self {
            user_id,
            media_id: entry.media.id,
            anilist_entry_id: Some(entry.id),
            status: entry.status.clone(),
            progress: entry.progress.unwrap_or(0),
            progress_volumes: entry.progress_volumes.unwrap_or(0),
            score: entry.score.unwrap_or(0.0).round() as i32,
            repeat: entry.repeat.unwrap_or(0),
            private: entry.private.unwrap_or(false),
            notes: entry.notes.clone().filter(|notes| !notes.is_empty()),
            started_at: fuzzy_to_date(entry.started_at),
            completed_at: fuzzy_to_date(entry.completed_at),
            anilist_updated_at: timestamp(entry.updated_at),
            updated_at: Utc::now(),
            dirty: false,
            push_attempts: 0,
            last_push_error: None,
        }
    }

    /// New entry, still without an AniList ID (media that was not in the list).
    pub fn blank(user_id: i64, media_id: i64) -> Self {
        Self {
            user_id,
            media_id,
            anilist_entry_id: None,
            status: "PLANNING".to_string(),
            progress: 0,
            progress_volumes: 0,
            score: 0,
            repeat: 0,
            private: false,
            notes: None,
            started_at: None,
            completed_at: None,
            anilist_updated_at: None,
            updated_at: Utc::now(),
            dirty: false,
            push_attempts: 0,
            last_push_error: None,
        }
    }
}
