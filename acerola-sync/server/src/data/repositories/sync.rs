use chrono::{DateTime, NaiveTime, Utc};
use sqlx::PgPool;

use crate::{
    data::models::sync::{SyncLog, SyncRun, SyncSettings},
    infra::error::DbError,
};

pub async fn settings(pool: &PgPool, user_id: i64) -> Result<SyncSettings, DbError> {
    Ok(sqlx::query_as(concat!(
        "INSERT INTO sync_settings (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING ",
        sync_settings_columns!("")
    ))
    .bind(user_id)
    .fetch_one(pool)
    .await?)
}

pub async fn all_enabled(pool: &PgPool) -> Result<Vec<SyncSettings>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        sync_settings_columns!(""),
        " FROM sync_settings WHERE schedule_enabled"
    ))
    .fetch_all(pool)
    .await?)
}

pub async fn save_schedule(
    pool: &PgPool, user_id: i64, enabled: bool, times: &[NaiveTime],
    last_scheduled_slot: Option<DateTime<Utc>>,
) -> Result<SyncSettings, DbError> {
    Ok(sqlx::query_as(
        concat!("INSERT INTO sync_settings (user_id, schedule_enabled, schedule_times, last_scheduled_slot, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (user_id) DO UPDATE SET
             schedule_enabled = EXCLUDED.schedule_enabled,
             schedule_times = EXCLUDED.schedule_times,
             last_scheduled_slot = EXCLUDED.last_scheduled_slot,
             updated_at = now()
         RETURNING ", sync_settings_columns!("")),
    )
    .bind(user_id)
    .bind(enabled)
    .bind(times)
    .bind(last_scheduled_slot)
    .fetch_one(pool)
    .await?)
}

/// Garante a linha de ajustes e grava o intervalo da lista inteira automática.
pub async fn save_full_sync_interval(
    pool: &PgPool, user_id: i64, hours: i32,
) -> Result<SyncSettings, DbError> {
    Ok(sqlx::query_as(concat!(
        "INSERT INTO sync_settings (user_id, full_sync_every_hours, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE SET
             full_sync_every_hours = EXCLUDED.full_sync_every_hours,
             updated_at = now()
         RETURNING ",
        sync_settings_columns!("")
    ))
    .bind(user_id)
    .bind(hours)
    .fetch_one(pool)
    .await?)
}

pub async fn mark_slot_done(
    pool: &PgPool, user_id: i64, slot: DateTime<Utc>,
) -> Result<(), DbError> {
    sqlx::query("UPDATE sync_settings SET last_scheduled_slot = $2 WHERE user_id = $1")
        .bind(user_id)
        .bind(slot)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn start_run(
    pool: &PgPool, user_id: i64, trigger: &str, mode: &str,
) -> Result<SyncRun, DbError> {
    Ok(sqlx::query_as(concat!(
        "INSERT INTO sync_runs (user_id, trigger, status, mode)
         VALUES ($1, $2, 'RUNNING', $3) RETURNING ",
        sync_run_columns!("")
    ))
    .bind(user_id)
    .bind(trigger)
    .bind(mode)
    .fetch_one(pool)
    .await?)
}

pub struct RunTotals {
    pub pulled: i32,
    pub pushed: i32,
    pub removed: i32,
    pub anilist_requests: i32,
}

pub async fn finish_run(
    pool: &PgPool, run_id: i64, totals: &RunTotals, error: Option<&str>,
) -> Result<SyncRun, DbError> {
    Ok(sqlx::query_as(concat!(
        "UPDATE sync_runs SET
             status = CASE WHEN $5::text IS NULL THEN 'SUCCESS' ELSE 'FAILED' END,
             finished_at = now(), entries_pulled = $2, entries_pushed = $3,
             entries_removed = $4, error = $5, anilist_requests = $6
         WHERE id = $1 RETURNING ",
        sync_run_columns!("")
    ))
    .bind(run_id)
    .bind(totals.pulled)
    .bind(totals.pushed)
    .bind(totals.removed)
    .bind(error)
    .bind(totals.anilist_requests)
    .fetch_one(pool)
    .await?)
}

/// Marca até onde o espelho está em dia. `full` também registra a lista inteira.
pub async fn mark_pulled(
    pool: &PgPool, user_id: i64, pulled_at: DateTime<Utc>, full: bool,
) -> Result<(), DbError> {
    sqlx::query(
        "INSERT INTO sync_settings (user_id, last_pull_at, last_full_sync_at)
         VALUES ($1, $2, CASE WHEN $3 THEN $2 END)
         ON CONFLICT (user_id) DO UPDATE SET
             last_pull_at = EXCLUDED.last_pull_at,
             last_full_sync_at = CASE WHEN $3 THEN $2 ELSE sync_settings.last_full_sync_at END",
    )
    .bind(user_id)
    .bind(pulled_at)
    .bind(full)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_log(
    pool: &PgPool, run_id: i64, level: &str, message: &str,
) -> Result<SyncLog, DbError> {
    Ok(sqlx::query_as(concat!(
        "INSERT INTO sync_logs (run_id, level, message) VALUES ($1, $2, $3) RETURNING ",
        sync_log_columns!("")
    ))
    .bind(run_id)
    .bind(level)
    .bind(message)
    .fetch_one(pool)
    .await?)
}

/// Logs de um sync depois de `after_id` — a tela pede só as linhas novas a cada segundo.
pub async fn logs_after(
    pool: &PgPool, user_id: i64, run_id: i64, after_id: i64,
) -> Result<Vec<SyncLog>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        sync_log_columns!("sync_logs."),
        " FROM sync_logs JOIN sync_runs ON sync_runs.id = sync_logs.run_id
         WHERE sync_runs.user_id = $1 AND sync_logs.run_id = $2 AND sync_logs.id > $3
         ORDER BY sync_logs.id
         LIMIT 500"
    ))
    .bind(user_id)
    .bind(run_id)
    .bind(after_id)
    .fetch_all(pool)
    .await?)
}

/// Sync que ficaram `RUNNING` porque o processo caiu no meio.
pub async fn fail_stale_runs(pool: &PgPool) -> Result<(), DbError> {
    sqlx::query(
        "UPDATE sync_runs SET status = 'FAILED', finished_at = now(), error = 'interrupted'
         WHERE status = 'RUNNING'",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn find_run(
    pool: &PgPool, user_id: i64, run_id: i64,
) -> Result<Option<SyncRun>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        sync_run_columns!(""),
        " FROM sync_runs WHERE user_id = $1 AND id = $2"
    ))
    .bind(user_id)
    .bind(run_id)
    .fetch_optional(pool)
    .await?)
}

/// Usuários com o sync automático ligado (intervalo da lista inteira diferente de "só no botão").
pub async fn all_auto(pool: &PgPool) -> Result<Vec<SyncSettings>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        sync_settings_columns!(""),
        " FROM sync_settings WHERE full_sync_every_hours > 0"
    ))
    .fetch_all(pool)
    .await?)
}

/// Quando começou o último sync do usuário, de qualquer tipo e com qualquer resultado.
pub async fn last_run_started_at(
    pool: &PgPool, user_id: i64,
) -> Result<Option<DateTime<Utc>>, DbError> {
    let row: Option<(DateTime<Utc>,)> = sqlx::query_as(
        "SELECT max(started_at) FROM sync_runs WHERE user_id = $1 HAVING count(*) > 0",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(at,)| at))
}

pub async fn recent_runs(pool: &PgPool, user_id: i64, limit: i64) -> Result<Vec<SyncRun>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        sync_run_columns!(""),
        " FROM sync_runs WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2"
    ))
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        data::repositories::users as user_repository,
        infra::db::test_support::{user, TestDatabase},
    };

    #[tokio::test]
    async fn teste_automatico_so_com_intervalo_e_conta_do_ultimo_sync() {
        let Some(db) = TestDatabase::create().await else { return };
        user_repository::upsert(&db.pool, &user(1)).await.unwrap();
        settings(&db.pool, 1).await.unwrap();
        assert_eq!(last_run_started_at(&db.pool, 1).await.unwrap(), None);
        // Padrão: lista inteira a cada 24h, então o automático vale.
        assert_eq!(all_auto(&db.pool).await.unwrap().len(), 1);

        let run = start_run(&db.pool, 1, "AUTO", "INCREMENTAL").await.unwrap();
        assert_eq!(last_run_started_at(&db.pool, 1).await.unwrap(), Some(run.started_at));

        save_full_sync_interval(&db.pool, 1, 0).await.unwrap();
        assert!(all_auto(&db.pool).await.unwrap().is_empty());
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_registra_run_e_logs_em_ordem() {
        let Some(db) = TestDatabase::create().await else { return };
        user_repository::upsert(&db.pool, &user(1)).await.unwrap();

        let run = start_run(&db.pool, 1, "MANUAL", "INCREMENTAL").await.unwrap();
        let first = insert_log(&db.pool, run.id, "INFO", "começou").await.unwrap();
        insert_log(&db.pool, run.id, "WARN", "AniList lento").await.unwrap();

        let all = logs_after(&db.pool, 1, run.id, 0).await.unwrap();
        assert_eq!(
            all.iter().map(|log| log.message.as_str()).collect::<Vec<_>>(),
            ["começou", "AniList lento"]
        );
        assert_eq!(logs_after(&db.pool, 1, run.id, first.id).await.unwrap().len(), 1);
        // Logs de outro usuário não aparecem.
        assert!(logs_after(&db.pool, 2, run.id, 0).await.unwrap().is_empty());

        let totals = RunTotals { pulled: 3, pushed: 1, removed: 0, anilist_requests: 2 };
        let finished = finish_run(&db.pool, run.id, &totals, None).await.unwrap();
        assert_eq!(finished.status, "SUCCESS");
        assert_eq!(finished.anilist_requests, 2);
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_pull_incremental_nao_mexe_na_data_do_completo() {
        let Some(db) = TestDatabase::create().await else { return };
        user_repository::upsert(&db.pool, &user(1)).await.unwrap();
        let full_at = Utc::now() - chrono::Duration::hours(2);
        mark_pulled(&db.pool, 1, full_at, true).await.unwrap();
        mark_pulled(&db.pool, 1, Utc::now(), false).await.unwrap();

        let saved = settings(&db.pool, 1).await.unwrap();
        assert_eq!(saved.last_full_sync_at.map(|at| at.timestamp()), Some(full_at.timestamp()));
        assert!(saved.last_pull_at.unwrap() > full_at);
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_falha_runs_interrompidos() {
        let Some(db) = TestDatabase::create().await else { return };
        user_repository::upsert(&db.pool, &user(1)).await.unwrap();
        start_run(&db.pool, 1, "SCHEDULED", "FULL").await.unwrap();
        fail_stale_runs(&db.pool).await.unwrap();
        assert_eq!(recent_runs(&db.pool, 1, 1).await.unwrap()[0].status, "FAILED");
        db.drop().await;
    }
}
