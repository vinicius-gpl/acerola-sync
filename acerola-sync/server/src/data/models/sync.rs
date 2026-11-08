use chrono::{DateTime, NaiveTime, Utc};
use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSettings {
    pub user_id: i64,
    pub schedule_enabled: bool,
    /// Horários em UTC.
    pub schedule_times: Vec<NaiveTime>,
    pub last_scheduled_slot: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    pub last_pull_at: Option<DateTime<Utc>>,
    pub last_full_sync_at: Option<DateTime<Utc>>,
    /// Lista inteira automática a cada N horas; `0` = só quando pedida.
    pub full_sync_every_hours: i32,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRun {
    pub id: i64,
    pub user_id: i64,
    pub trigger: String,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub entries_pulled: i32,
    pub entries_pushed: i32,
    pub entries_removed: i32,
    pub error: Option<String>,
    pub mode: String,
    pub anilist_requests: i32,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncLog {
    pub id: i64,
    pub run_id: i64,
    pub level: String,
    pub message: String,
    pub created_at: DateTime<Utc>,
}
