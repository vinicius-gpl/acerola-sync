use sqlx::{PgExecutor, PgPool};

use crate::{data::models::media::Media, infra::error::DbError};

pub async fn upsert(executor: impl PgExecutor<'_>, media: &Media) -> Result<(), DbError> {
    sqlx::query(
        "INSERT INTO media (
             id, id_mal, media_type, format, status, title_romaji, title_english, title_native,
             title_user_preferred, synonyms, description, episodes, chapters, volumes, duration,
             season, season_year, average_score, genres, is_adult, country_of_origin, cover_url,
             cover_color, banner_url, site_url, next_airing_episode, next_airing_at,
             anilist_updated_at, synced_at, search_text, start_year, source, studios,
             start_date, end_date, external_links, relations
         ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
             $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
             $35, $36, $37
         )
         ON CONFLICT (id) DO UPDATE SET
             id_mal = EXCLUDED.id_mal,
             media_type = EXCLUDED.media_type,
             format = EXCLUDED.format,
             status = EXCLUDED.status,
             title_romaji = EXCLUDED.title_romaji,
             title_english = EXCLUDED.title_english,
             title_native = EXCLUDED.title_native,
             title_user_preferred = EXCLUDED.title_user_preferred,
             synonyms = EXCLUDED.synonyms,
             description = COALESCE(EXCLUDED.description, media.description),
             episodes = EXCLUDED.episodes,
             chapters = EXCLUDED.chapters,
             volumes = EXCLUDED.volumes,
             duration = EXCLUDED.duration,
             season = COALESCE(EXCLUDED.season, media.season),
             season_year = EXCLUDED.season_year,
             average_score = EXCLUDED.average_score,
             genres = CASE WHEN cardinality(EXCLUDED.genres) = 0
                           THEN media.genres ELSE EXCLUDED.genres END,
             is_adult = EXCLUDED.is_adult,
             country_of_origin = COALESCE(EXCLUDED.country_of_origin, media.country_of_origin),
             cover_url = EXCLUDED.cover_url,
             cover_color = EXCLUDED.cover_color,
             banner_url = COALESCE(EXCLUDED.banner_url, media.banner_url),
             site_url = EXCLUDED.site_url,
             next_airing_episode = EXCLUDED.next_airing_episode,
             next_airing_at = EXCLUDED.next_airing_at,
             anilist_updated_at = EXCLUDED.anilist_updated_at,
             synced_at = EXCLUDED.synced_at,
             search_text = EXCLUDED.search_text,
             start_year = COALESCE(EXCLUDED.start_year, media.start_year),
             source = COALESCE(EXCLUDED.source, media.source),
             studios = CASE WHEN cardinality(EXCLUDED.studios) = 0
                            THEN media.studios ELSE EXCLUDED.studios END,
             start_date = COALESCE(EXCLUDED.start_date, media.start_date),
             end_date = COALESCE(EXCLUDED.end_date, media.end_date),
             external_links = CASE WHEN jsonb_array_length(EXCLUDED.external_links) = 0
                                   THEN media.external_links ELSE EXCLUDED.external_links END,
             relations = CASE WHEN jsonb_array_length(EXCLUDED.relations) = 0
                              THEN media.relations ELSE EXCLUDED.relations END",
    )
    .bind(media.id)
    .bind(media.id_mal)
    .bind(&media.media_type)
    .bind(&media.format)
    .bind(&media.status)
    .bind(&media.title_romaji)
    .bind(&media.title_english)
    .bind(&media.title_native)
    .bind(&media.title_user_preferred)
    .bind(&media.synonyms)
    .bind(&media.description)
    .bind(media.episodes)
    .bind(media.chapters)
    .bind(media.volumes)
    .bind(media.duration)
    .bind(&media.season)
    .bind(media.season_year)
    .bind(media.average_score)
    .bind(&media.genres)
    .bind(media.is_adult)
    .bind(&media.country_of_origin)
    .bind(&media.cover_url)
    .bind(&media.cover_color)
    .bind(&media.banner_url)
    .bind(&media.site_url)
    .bind(media.next_airing_episode)
    .bind(media.next_airing_at)
    .bind(media.anilist_updated_at)
    .bind(media.synced_at)
    .bind(&media.search_text)
    .bind(media.start_year)
    .bind(&media.source)
    .bind(&media.studios)
    .bind(media.start_date)
    .bind(media.end_date)
    .bind(&media.external_links)
    .bind(&media.relations)
    .execute(executor)
    .await?;
    Ok(())
}

/// A lista e a busca usam a query leve (sem sinopse, banner, gêneros): o que já veio do
/// detalhe não pode ser apagado por elas. Por isso esses campos usam `COALESCE`.
pub async fn mark_details_synced(pool: &PgPool, id: i64) -> Result<(), DbError> {
    sqlx::query("UPDATE media SET details_synced_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Atualiza só o próximo episódio (e status/total) de uma obra em lançamento.
pub async fn update_airing(
    pool: &PgPool, id: i64, status: Option<&str>, episodes: Option<i32>, next_episode: Option<i32>,
    next_airing_at: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<(), DbError> {
    sqlx::query(
        "UPDATE media SET status = COALESCE($2, status), episodes = COALESCE($3, episodes),
                          next_airing_episode = $4, next_airing_at = $5, synced_at = now()
         WHERE id = $1",
    )
    .bind(id)
    .bind(status)
    .bind(episodes)
    .bind(next_episode)
    .bind(next_airing_at)
    .execute(pool)
    .await?;
    Ok(())
}

/// Obras em lançamento que o usuário acompanha (ou planeja): as únicas cujo próximo episódio
/// precisa ser atualizado no sync incremental.
pub async fn releasing_ids_for_user(pool: &PgPool, user_id: i64) -> Result<Vec<i64>, DbError> {
    let rows: Vec<(i64,)> = sqlx::query_as(
        "SELECT media.id FROM media JOIN entries ON entries.media_id = media.id
         WHERE entries.user_id = $1
           AND media.media_type = 'ANIME'
           AND media.status IN ('RELEASING', 'NOT_YET_RELEASED')
           AND entries.status IN ('CURRENT', 'PLANNING', 'REPEATING', 'PAUSED')
         ORDER BY media.id",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

pub async fn find(executor: impl PgExecutor<'_>, id: i64) -> Result<Option<Media>, DbError> {
    Ok(sqlx::query_as(concat!("SELECT ", media_columns!(""), " FROM media WHERE id = $1"))
        .bind(id)
        .fetch_optional(executor)
        .await?)
}

pub async fn find_many(pool: &PgPool, ids: &[i64]) -> Result<Vec<Media>, DbError> {
    Ok(sqlx::query_as(concat!("SELECT ", media_columns!(""), " FROM media WHERE id = ANY($1)"))
        .bind(ids)
        .fetch_all(pool)
        .await?)
}

/// Resultado da busca local com a nota de similaridade (0–1) do pg_trgm.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ScoredMedia {
    #[sqlx(flatten)]
    pub media: Media,
    pub similarity: f32,
}

/// Busca fuzzy nos títulos. `word_similarity` acha "frieren" dentro de "sousou no frieren".
pub async fn search(
    pool: &PgPool, query: &str, media_type: Option<&str>, limit: i64,
) -> Result<Vec<ScoredMedia>, DbError> {
    Ok(sqlx::query_as(concat!(
        "SELECT ",
        media_columns!("media."),
        ", word_similarity($1, search_text) AS similarity
         FROM media
         WHERE ($2::text IS NULL OR media_type = $2)
           AND (search_text ILIKE '%' || $1 || '%' OR $1 <% search_text)
         ORDER BY similarity DESC, title_user_preferred
         LIMIT $3"
    ))
    .bind(query.to_lowercase())
    .bind(media_type)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::test_support::{media, TestDatabase};

    #[tokio::test]
    async fn teste_query_leve_nao_apaga_sinopse_banner_e_generos() {
        let Some(db) = TestDatabase::create().await else { return };
        let mut detailed = media(1, "ANIME", "Frieren");
        detailed.description = Some("sinopse".into());
        detailed.banner_url = Some("banner.jpg".into());
        detailed.genres = vec!["Adventure".into()];
        upsert(&db.pool, &detailed).await.unwrap();

        let mut light = media(1, "ANIME", "Frieren");
        light.episodes = Some(28);
        upsert(&db.pool, &light).await.unwrap();

        let saved = find(&db.pool, 1).await.unwrap().unwrap();
        assert_eq!(saved.description.as_deref(), Some("sinopse"));
        assert_eq!(saved.banner_url.as_deref(), Some("banner.jpg"));
        assert_eq!(saved.genres, vec!["Adventure".to_string()]);
        assert_eq!(saved.episodes, Some(28));
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_busca_ignora_maiusculas_e_acha_pedaco_do_titulo() {
        let Some(db) = TestDatabase::create().await else { return };
        let mut frieren = media(1, "ANIME", "Sousou no Frieren");
        frieren.search_text = "sousou no frieren".into();
        upsert(&db.pool, &frieren).await.unwrap();
        upsert(&db.pool, &media(2, "MANGA", "Chainsaw Man")).await.unwrap();

        let hits = search(&db.pool, "FRIEREN", None, 10).await.unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].media.id, 1);

        assert!(search(&db.pool, "frieren", Some("MANGA"), 10).await.unwrap().is_empty());
        db.drop().await;
    }

    #[tokio::test]
    async fn teste_atualiza_so_o_proximo_episodio() {
        let Some(db) = TestDatabase::create().await else { return };
        let mut airing = media(1, "ANIME", "Dandadan");
        airing.status = Some("RELEASING".into());
        upsert(&db.pool, &airing).await.unwrap();

        let at = chrono::Utc::now();
        update_airing(&db.pool, 1, Some("RELEASING"), None, Some(8), Some(at)).await.unwrap();

        let saved = find(&db.pool, 1).await.unwrap().unwrap();
        assert_eq!(saved.next_airing_episode, Some(8));
        assert_eq!(saved.episodes, Some(12));
        assert_eq!(saved.title_user_preferred, "Dandadan");
        db.drop().await;
    }
}
