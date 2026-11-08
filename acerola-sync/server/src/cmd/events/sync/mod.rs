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
    /// Força a lista inteira em vez do incremental.
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
    /// Horas entre listas inteiras automáticas; `0` = só no botão.
    pub hours: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRequest {
    pub enabled: bool,
    /// Horários em UTC (`HH:MM`).
    pub times: Vec<NaiveTime>,
}
