//! Acesso ao banco. As tabelas têm chave composta (`user_id`, `media_id`…), então cada uma
//! tem o seu módulo com SQL explícito.

/// Colunas explícitas, nunca `*`: com `SELECT *`/`RETURNING *`, uma migration que adiciona coluna
/// muda o resultado das consultas já preparadas, e o Postgres recusa o plano guardado nas conexões
/// do pooler ("cached plan must not change result type"). O prefixo (`"entries."`) qualifica as
/// colunas quando há JOIN.
macro_rules! columns {
    ($prefix:literal; $first:ident $(, $rest:ident)* $(,)?) => {
        concat!($prefix, stringify!($first) $(, ", ", $prefix, stringify!($rest))*)
    };
}

macro_rules! user_columns {
    ($prefix:literal) => {
        columns!($prefix; id, name, avatar_url, site_url, anilist_token_cipher, anilist_token_nonce, created_at, updated_at)
    };
}

macro_rules! sync_settings_columns {
    ($prefix:literal) => {
        columns!($prefix; user_id, schedule_enabled, schedule_times, last_scheduled_slot, updated_at, last_pull_at, last_full_sync_at, full_sync_every_hours)
    };
}

macro_rules! sync_run_columns {
    ($prefix:literal) => {
        columns!($prefix; id, user_id, trigger, status, started_at, finished_at, entries_pulled, entries_pushed, entries_removed, error, mode, anilist_requests)
    };
}

macro_rules! sync_log_columns {
    ($prefix:literal) => {
        columns!($prefix; id, run_id, level, message, created_at)
    };
}

macro_rules! site_mapping_columns {
    ($prefix:literal) => {
        columns!($prefix; user_id, site, identifier, media_id, title, source, created_at, updated_at)
    };
}

macro_rules! custom_site_columns {
    ($prefix:literal) => {
        columns!($prefix; id, user_id, name, media_type, match_pattern, url_pattern, title_selector, enabled, created_at, search_url, updated_at, progress_source, progress_selector, progress_pattern)
    };
}

macro_rules! entry_columns {
    ($prefix:literal) => {
        columns!($prefix; user_id, media_id, anilist_entry_id, status, progress, progress_volumes, score, repeat, private, notes, started_at, completed_at, anilist_updated_at, updated_at, dirty, push_attempts, last_push_error)
    };
}

macro_rules! media_columns {
    ($prefix:literal) => {
        columns!($prefix; id, id_mal, media_type, format, status, title_romaji, title_english, title_native, title_user_preferred, synonyms, description, episodes, chapters, volumes, duration, season, season_year, start_year, average_score, genres, is_adult, country_of_origin, cover_url, cover_color, banner_url, site_url, next_airing_episode, next_airing_at, anilist_updated_at, synced_at, search_text, details_synced_at, source, studios, start_date, end_date, external_links, relations)
    };
}

pub mod entries;
pub mod media;
pub mod sync;
pub mod tracking;
pub mod users;
