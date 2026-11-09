use sqlx::{AssertSqlSafe, PgExecutor, PgPool};

use crate::{
    data::models::entry::{Entry, EntryCount, EntryFacets, EntryWithMedia},
    data::repositories::media as media_repository,
    infra::error::DbError,
};

pub async fn upsert(executor: impl PgExecutor<'_>, entry: &Entry) -> Result<Entry, DbError> {
    Ok(sqlx::query_as(concat!(
        "INSERT INTO entries (
             user_id, media_id, anilist_entry_id, status, progress, progress_volumes, score,
             repeat, private, notes, started_at, completed_at, anilist_updated_at, updated_at,
             dirty, push_attempts, last_push_error
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (user_id, media_id) DO UPDATE SET
             anilist_entry_id = COALESCE(EXCLUDED.anilist_entry_id, entries.anilist_entry_id),
             status = EXCLUDED.status,
             progress = EXCLUDED.progress,
             progress_volumes = EXCLUDED.progress_volumes,
             score = EXCLUDED.score,
             repeat = EXCLUDED.repeat,
             private = EXCLUDED.private,
             notes = EXCLUDED.notes,
             started_at = EXCLUDED.started_at,
             completed_at = EXCLUDED.completed_at,
             anilist_updated_at = EXCLUDED.anilist_updated_at,
             updated_at = EXCLUDED.updated_at,
             dirty = EXCLUDED.dirty,
             push_attempts = EXCLUDED.push_attempts,
             last_push_error = EXCLUDED.last_push_error
         RETURNING ",
        entry_columns!("")
    ))
    .bind(entry.user_id)
    .bind(entry.media_id)
    .bind(entry.anilist_entry_id)
    .bind(&entry.status)
    .bind(entry.progress)
    .bind(entry.progress_volumes)
    .bind(entry.score)
    .bind(entry.repeat)
    .bind(entry.private)
    .bind(&entry.notes)
    .bind(entry.started_at)
    .bind(entry.completed_at)
    .bind(entry.anilist_updated_at)
    .bind(entry.updated_at)
    .bind(entry.dirty)
    .bind(entry.push_attempts)
    .bind(&entry.last_push_error)
    .fetch_one(executor)
    .await?)
}

pub async fn find(
    executor: impl PgExecutor<'_>, user_id: i64, media_id: i64,
) -> Result<Option<Entry>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        entry_columns!(""),
        " FROM entries WHERE user_id = $1 AND media_id = $2"
    ))
    .bind(user_id)
    .bind(media_id)
    .fetch_optional(executor)
    .await?)
}

/// Várias entradas de uma vez (busca): uma query só, em vez de uma por resultado.
pub async fn find_many(
    pool: &PgPool, user_id: i64, media_ids: &[i64],
) -> Result<Vec<Entry>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        entry_columns!(""),
        " FROM entries WHERE user_id = $1 AND media_id = ANY($2)"
    ))
    .bind(user_id)
    .bind(media_ids)
    .fetch_all(pool)
    .await?)
}

/// Quantas entradas há em cada (tipo, status), respeitando os filtros da lista (o status
/// dos filtros é ignorado: a contagem é justamente por status).
pub async fn count_by_status(
    pool: &PgPool, user_id: i64, filters: &EntryFilters,
) -> Result<Vec<EntryCount>, DbError> {
    let sql = format!(
        "SELECT media.media_type, entries.status, COUNT(*) AS count
         FROM entries JOIN media ON media.id = entries.media_id
         WHERE entries.user_id = $1 AND {FILTER_SQL}
         GROUP BY media.media_type, entries.status
         ORDER BY media.media_type, entries.status"
    );
    // O SQL dinâmico só junta constantes (`FILTER_SQL`); os valores vão por bind.
    Ok(bind_filters(sqlx::query_as(AssertSqlSafe(sql)).bind(user_id), filters, false)
        .fetch_all(pool)
        .await?)
}

/// Gêneros, formatos e anos que existem na lista do usuário, para montar os filtros.
pub async fn facets(
    pool: &PgPool, user_id: i64, media_type: Option<&str>,
) -> Result<EntryFacets, DbError> {
    Ok(sqlx::query_as(
        "SELECT
             COALESCE(ARRAY(SELECT DISTINCT genre FROM entries
                 JOIN media ON media.id = entries.media_id, unnest(media.genres) AS genre
                 WHERE entries.user_id = $1 AND ($2::text IS NULL OR media.media_type = $2)
                 ORDER BY genre), '{}') AS genres,
             COALESCE(ARRAY(SELECT DISTINCT media.format FROM entries
                 JOIN media ON media.id = entries.media_id
                 WHERE entries.user_id = $1 AND ($2::text IS NULL OR media.media_type = $2)
                   AND media.format IS NOT NULL
                 ORDER BY media.format), '{}') AS formats,
             COALESCE(ARRAY(SELECT DISTINCT COALESCE(media.season_year, media.start_year)
                 FROM entries JOIN media ON media.id = entries.media_id
                 WHERE entries.user_id = $1 AND ($2::text IS NULL OR media.media_type = $2)
                   AND COALESCE(media.season_year, media.start_year) IS NOT NULL
                 ORDER BY 1 DESC), '{}') AS years",
    )
    .bind(user_id)
    .bind(media_type)
    .fetch_one(pool)
    .await?)
}

pub async fn find_dirty(pool: &PgPool, user_id: i64) -> Result<Vec<Entry>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        entry_columns!(""),
        " FROM entries WHERE user_id = $1 AND dirty ORDER BY updated_at"
    ))
    .bind(user_id)
    .fetch_all(pool)
    .await?)
}

pub async fn mark_push_failed(
    pool: &PgPool, user_id: i64, media_id: i64, error: &str,
) -> Result<(), DbError> {
    sqlx::query(
        "UPDATE entries SET push_attempts = push_attempts + 1, last_push_error = $3
         WHERE user_id = $1 AND media_id = $2",
    )
    .bind(user_id)
    .bind(media_id)
    .bind(error)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete(
    executor: impl PgExecutor<'_>, user_id: i64, media_id: i64,
) -> Result<(), DbError> {
    sqlx::query("DELETE FROM entries WHERE user_id = $1 AND media_id = $2")
        .bind(user_id)
        .bind(media_id)
        .execute(executor)
        .await?;
    Ok(())
}

/// Remove do espelho o que sumiu do AniList, sem tocar no que ainda está pendente de envio.
pub async fn delete_missing(
    executor: impl PgExecutor<'_>, user_id: i64, media_type: &str, kept_media_ids: &[i64],
) -> Result<u64, DbError> {
    let result = sqlx::query(
        "DELETE FROM entries USING media
         WHERE entries.media_id = media.id
           AND entries.user_id = $1
           AND media.media_type = $2
           AND NOT entries.dirty
           AND NOT (entries.media_id = ANY($3))",
    )
    .bind(user_id)
    .bind(media_type)
    .bind(kept_media_ids)
    .execute(executor)
    .await?;
    Ok(result.rows_affected())
}

/// Uma página da lista. A tela pede de pouco em pouco (rolagem infinita): uma aba com 475
/// completos não vem de uma vez.
#[derive(Debug, Clone, Copy)]
pub struct PageRequest {
    pub limit: i64,
    pub offset: i64,
}

impl PageRequest {
    pub const DEFAULT_LIMIT: i64 = 48;
    pub const MAX_LIMIT: i64 = 200;

    pub fn new(limit: Option<i64>, offset: Option<i64>) -> Self {
        Self {
            limit: limit.unwrap_or(Self::DEFAULT_LIMIT).clamp(1, Self::MAX_LIMIT),
            offset: offset.unwrap_or(0).max(0),
        }
    }
}

/// Ordem da lista. Cada uma desempata pelo id para a paginação não repetir nem pular.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum EntrySort {
    #[default]
    Updated,
    Title,
    Score,
    Progress,
    Average,
    Year,
}

impl EntrySort {
    pub fn parse(value: Option<&str>) -> Self {
        match value.map(str::to_ascii_lowercase).as_deref() {
            Some("title") => Self::Title,
            Some("score") => Self::Score,
            Some("progress") => Self::Progress,
            Some("average") => Self::Average,
            Some("year") => Self::Year,
            _ => Self::Updated,
        }
    }

    fn order_by(self) -> &'static str {
        match self {
            Self::Updated => "entries.updated_at DESC",
            Self::Title => "lower(media.title_user_preferred) ASC",
            Self::Score => "entries.score DESC NULLS LAST, entries.updated_at DESC",
            Self::Progress => "entries.progress DESC, entries.updated_at DESC",
            Self::Average => "media.average_score DESC NULLS LAST",
            Self::Year => {
                "COALESCE(media.season_year, media.start_year) DESC NULLS LAST, \
                 entries.updated_at DESC"
            },
        }
    }
}

/// Filtros da lista, todos aplicados no banco. Vazio/`None` = não filtra.
#[derive(Debug, Clone, Default)]
pub struct EntryFilters {
    pub media_type: Option<String>,
    pub statuses: Vec<String>,
    /// Trecho do título (qualquer título ou sinônimo, sem acento de maiúscula).
    pub query: Option<String>,
    pub formats: Vec<String>,
    /// A obra precisa ter todos estes gêneros.
    pub genres: Vec<String>,
    pub year: Option<i32>,
    /// Situação da obra no AniList (`RELEASING`, `FINISHED`…).
    pub media_statuses: Vec<String>,
}

/// Mesmo `WHERE` na lista e na contagem. `$2..$8` = tipo, status, busca, formatos, gêneros,
/// ano, situação.
const FILTER_SQL: &str = "($2::text IS NULL OR media.media_type = $2)
           AND (cardinality($3::text[]) = 0 OR entries.status = ANY($3))
           AND ($4::text IS NULL OR media.search_text LIKE '%' || $4 || '%')
           AND (cardinality($5::text[]) = 0 OR media.format = ANY($5))
           AND (cardinality($6::text[]) = 0 OR media.genres @> $6)
           AND ($7::int IS NULL OR COALESCE(media.season_year, media.start_year) = $7)
           AND (cardinality($8::text[]) = 0 OR media.status = ANY($8))";

fn bind_filters<'q, O>(
    query: sqlx::query::QueryAs<'q, sqlx::Postgres, O, sqlx::postgres::PgArguments>,
    filters: &'q EntryFilters, with_status: bool,
) -> sqlx::query::QueryAs<'q, sqlx::Postgres, O, sqlx::postgres::PgArguments> {
    // `search_text` já é minúsculo; `%`/`_` digitados viram texto, não curinga.
    let query_text =
        filters.query.as_deref().map(str::trim).filter(|text| !text.is_empty()).map(|text| {
            text.to_lowercase().replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
        });
    let no_statuses: &[String] = &[];
    query
        .bind(filters.media_type.as_deref())
        .bind(if with_status { filters.statuses.as_slice() } else { no_statuses })
        .bind(query_text)
        .bind(filters.formats.as_slice())
        .bind(filters.genres.as_slice())
        .bind(filters.year)
        .bind(filters.media_statuses.as_slice())
}

/// Uma página da lista do usuário (com as obras), filtrada e ordenada no banco.
pub async fn list_with_media(
    pool: &PgPool, user_id: i64, filters: &EntryFilters, sort: EntrySort, page: PageRequest,
) -> Result<Vec<EntryWithMedia>, DbError> {
    let sql = format!(
        "SELECT {columns} FROM entries JOIN media ON media.id = entries.media_id
         WHERE entries.user_id = $1 AND {FILTER_SQL}
         ORDER BY {}, entries.media_id
         LIMIT $9 OFFSET $10",
        sort.order_by(),
        columns = entry_columns!("entries.")
    );
    // Só constantes (`FILTER_SQL` e a ordem de um enum fechado); os valores vão por bind.
    let entries: Vec<Entry> =
        bind_filters(sqlx::query_as(AssertSqlSafe(sql)).bind(user_id), filters, true)
            .bind(page.limit)
            .bind(page.offset)
            .fetch_all(pool)
            .await?;

    attach_media(pool, entries).await
}

pub async fn attach_media(
    pool: &PgPool, entries: Vec<Entry>,
) -> Result<Vec<EntryWithMedia>, DbError> {
    let ids: Vec<i64> = entries.iter().map(|entry| entry.media_id).collect();
    let media = media_repository::find_many(pool, &ids).await?;
    let by_id: std::collections::HashMap<i64, _> =
        media.into_iter().map(|media| (media.id, media)).collect();

    Ok(entries
        .into_iter()
        .filter_map(|entry| {
            let media = by_id.get(&entry.media_id)?.clone();
            Some(EntryWithMedia { entry, media })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        data::repositories::{media as media_repository, users as user_repository},
        infra::db::test_support::{media, user, TestDatabase},
    };

    async fn seed(pool: &PgPool) {
        user_repository::upsert(pool, &user(1)).await.unwrap();
        let mut airing = media(10, "ANIME", "Dandadan");
        airing.status = Some("RELEASING".into());
        media_repository::upsert(pool, &airing).await.unwrap();
        media_repository::upsert(pool, &media(11, "ANIME", "Frieren")).await.unwrap();
        media_repository::upsert(pool, &media(20, "MANGA", "Chainsaw Man")).await.unwrap();
        for (media_id, status) in [(10, "CURRENT"), (11, "COMPLETED"), (20, "CURRENT")] {
            let entry = Entry { status: status.into(), ..Entry::blank(1, media_id) };
            upsert(pool, &entry).await.unwrap();
        }
    }

    #[tokio::test]
    async fn teste_conta_por_tipo_e_status() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;

        let counts = count_by_status(&db.pool, 1, &EntryFilters::default()).await.unwrap();
        let find = |kind: &str, status: &str| {
            counts.iter().find(|c| c.media_type == kind && c.status == status).map(|c| c.count)
        };
        assert_eq!(find("ANIME", "CURRENT"), Some(1));
        assert_eq!(find("ANIME", "COMPLETED"), Some(1));
        assert_eq!(find("MANGA", "CURRENT"), Some(1));
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_lista_filtra_por_tipo_e_status() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;

        let all = PageRequest::new(None, None);
        let anime = EntryFilters { media_type: Some("ANIME".into()), ..Default::default() };
        let anime = list_with_media(&db.pool, 1, &anime, EntrySort::Updated, all).await.unwrap();
        assert_eq!(anime.len(), 2);
        let completed = EntryFilters { statuses: vec!["COMPLETED".into()], ..Default::default() };
        let completed =
            list_with_media(&db.pool, 1, &completed, EntrySort::Updated, all).await.unwrap();
        assert_eq!(completed.len(), 1);
        assert_eq!(completed[0].media.title_user_preferred, "Frieren");
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_remocao_do_sync_preserva_pendentes() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;
        let pending = Entry { dirty: true, ..find(&db.pool, 1, 11).await.unwrap().unwrap() };
        upsert(&db.pool, &pending).await.unwrap();

        // O AniList só devolveu a obra 10: a 11 sumiu de lá, mas está pendente aqui.
        let removed = delete_missing(&db.pool, 1, "ANIME", &[10]).await.unwrap();
        assert_eq!(removed, 0);
        assert!(find(&db.pool, 1, 11).await.unwrap().is_some());

        let clean = Entry { dirty: false, ..pending };
        upsert(&db.pool, &clean).await.unwrap();
        assert_eq!(delete_missing(&db.pool, 1, "ANIME", &[10]).await.unwrap(), 1);
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_lista_paginada_sem_repetir() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;

        let none = EntryFilters::default();
        let first =
            list_with_media(&db.pool, 1, &none, EntrySort::Title, PageRequest::new(Some(2), None))
                .await
                .unwrap();
        let second = list_with_media(
            &db.pool,
            1,
            &none,
            EntrySort::Title,
            PageRequest::new(Some(2), Some(2)),
        )
        .await
        .unwrap();
        assert_eq!(first.len(), 2);
        assert_eq!(second.len(), 1);
        assert!(second
            .iter()
            .all(|item| first.iter().all(|seen| seen.entry.media_id != item.entry.media_id)));
        db.drop().await;
    }

    async fn seed_filters(pool: &PgPool) {
        user_repository::upsert(pool, &user(1)).await.unwrap();
        let mut frieren = media(1, "ANIME", "Sousou no Frieren");
        frieren.search_text = "sousou no frieren | frieren: beyond journey's end".into();
        frieren.genres = vec!["Adventure".into(), "Drama".into(), "Fantasy".into()];
        frieren.season_year = Some(2023);
        frieren.average_score = Some(90);
        let mut movie = media(2, "ANIME", "Kimi no Na wa");
        movie.search_text = "kimi no na wa | your name".into();
        movie.format = Some("MOVIE".into());
        movie.genres = vec!["Drama".into(), "Romance".into()];
        movie.season_year = Some(2016);
        movie.average_score = Some(85);
        let mut manga = media(3, "MANGA", "Chainsaw Man");
        manga.search_text = "chainsaw man | 100%_fan".into();
        manga.format = Some("MANGA".into());
        manga.status = Some("RELEASING".into());
        manga.genres = vec!["Action".into(), "Drama".into()];
        manga.season_year = None;
        manga.start_year = Some(2018);
        for (item, score) in [(&frieren, 100), (&movie, 70), (&manga, 90)] {
            media_repository::upsert(pool, item).await.unwrap();
            let entry = Entry { status: "COMPLETED".into(), score, ..Entry::blank(1, item.id) };
            upsert(pool, &entry).await.unwrap();
        }
    }

    async fn ids(pool: &PgPool, filters: EntryFilters, sort: EntrySort) -> Vec<i64> {
        list_with_media(pool, 1, &filters, sort, PageRequest::new(None, None))
            .await
            .unwrap()
            .into_iter()
            .map(|item| item.media.id)
            .collect()
    }

    #[tokio::test]
    async fn teste_filtros_da_lista_no_banco() {
        let Some(db) = TestDatabase::create().await else { return };
        seed_filters(&db.pool).await;
        let pool = &db.pool;
        let with = |change: fn(&mut EntryFilters)| {
            let mut filters = EntryFilters::default();
            change(&mut filters);
            filters
        };

        // Busca em qualquer título/sinônimo, sem diferenciar maiúscula.
        assert_eq!(
            ids(pool, with(|f| f.query = Some(" YOUR Name ".into())), EntrySort::Title).await,
            [2]
        );
        // `%` e `_` digitados são texto, não curinga.
        assert_eq!(
            ids(pool, with(|f| f.query = Some("100%_".into())), EntrySort::Title).await,
            [3]
        );
        assert!(ids(pool, with(|f| f.query = Some("a%n".into())), EntrySort::Title)
            .await
            .is_empty());
        assert_eq!(
            ids(pool, with(|f| f.formats = vec!["MOVIE".into()]), EntrySort::Title).await,
            [2]
        );
        // Gêneros: precisa ter todos.
        assert_eq!(
            ids(pool, with(|f| f.genres = vec!["Drama".into()]), EntrySort::Title).await,
            [3, 2, 1]
        );
        assert_eq!(
            ids(
                pool,
                with(|f| f.genres = vec!["Drama".into(), "Fantasy".into()]),
                EntrySort::Title
            )
            .await,
            [1]
        );
        // Ano: mangá cai no ano de início.
        assert_eq!(ids(pool, with(|f| f.year = Some(2018)), EntrySort::Title).await, [3]);
        assert_eq!(
            ids(pool, with(|f| f.media_statuses = vec!["RELEASING".into()]), EntrySort::Title)
                .await,
            [3]
        );
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_ordenacoes_da_lista() {
        let Some(db) = TestDatabase::create().await else { return };
        seed_filters(&db.pool).await;
        let pool = &db.pool;
        let none = EntryFilters::default;

        assert_eq!(ids(pool, none(), EntrySort::Title).await, [3, 2, 1]);
        assert_eq!(ids(pool, none(), EntrySort::Score).await, [1, 3, 2]);
        assert_eq!(ids(pool, none(), EntrySort::Average).await, [1, 2, 3]);
        assert_eq!(ids(pool, none(), EntrySort::Year).await, [1, 3, 2]);
        assert_eq!(EntrySort::parse(Some("whatever")), EntrySort::Updated);
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_contagem_respeita_filtros_e_facetas() {
        let Some(db) = TestDatabase::create().await else { return };
        seed_filters(&db.pool).await;

        let drama_anime = EntryFilters {
            media_type: Some("ANIME".into()),
            genres: vec!["Drama".into()],
            // Ignorado na contagem: ela é por status.
            statuses: vec!["CURRENT".into()],
            ..Default::default()
        };
        let counts = count_by_status(&db.pool, 1, &drama_anime).await.unwrap();
        assert_eq!(counts.len(), 1);
        assert_eq!((counts[0].status.as_str(), counts[0].count), ("COMPLETED", 2));

        let anime = facets(&db.pool, 1, Some("ANIME")).await.unwrap();
        assert_eq!(anime.genres, ["Adventure", "Drama", "Fantasy", "Romance"]);
        assert_eq!(anime.formats, ["MOVIE", "TV"]);
        assert_eq!(anime.years, [2023, 2016]);
        assert_eq!(facets(&db.pool, 1, Some("MANGA")).await.unwrap().years, [2018]);
        db.drop().await;
    }

    #[test]
    fn teste_pagina_respeita_limites() {
        let page = PageRequest::new(Some(10_000), Some(-5));
        assert_eq!(page.limit, PageRequest::MAX_LIMIT);
        assert_eq!(page.offset, 0);
        assert_eq!(PageRequest::new(None, None).limit, PageRequest::DEFAULT_LIMIT);
    }

    #[tokio::test]
    async fn teste_busca_varias_entradas_numa_query() {
        let Some(db) = TestDatabase::create().await else { return };
        seed(&db.pool).await;
        let found = find_many(&db.pool, 1, &[10, 20, 99]).await.unwrap();
        assert_eq!(found.len(), 2);
        db.drop().await;
    }
}
