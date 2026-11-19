use chrono::NaiveTime;
use serde::{Deserialize, Serialize};

use crate::data::models::sync::{SyncLog, SyncRun, SyncSettings};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusPayload {
    pub settings: SyncSettings,
    pub runs: Vec<SyncRun>,
    pub running: bool,
    pub pending_entries: usize,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncQuery {
    /// Forces the whole list instead of the incremental one.
    #[serde(default)]
    pub full: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogsQuery {
    #[serde(default)]
    pub after: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncLogsPayload {
    pub run: SyncRun,
    pub logs: Vec<SyncLog>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullSyncIntervalRequest {
    /// Hours between automatic full lists; `0` = only by the button.
    pub hours: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRequest {
    pub enabled: bool,
    /// Times in UTC (`HH:MM`).
    pub times: Vec<NaiveTime>,
}
