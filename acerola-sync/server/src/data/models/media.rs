use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{types::Json, FromRow};

use crate::infra::anilist::types as anilist;

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    pub id: i64,
    pub id_mal: Option<i64>,
    pub media_type: String,
    pub format: Option<String>,
    pub status: Option<String>,
    pub title_romaji: Option<String>,
    pub title_english: Option<String>,
    pub title_native: Option<String>,
    pub title_user_preferred: String,
    pub synonyms: Vec<String>,
    pub description: Option<String>,
    pub episodes: Option<i32>,
    pub chapters: Option<i32>,
    pub volumes: Option<i32>,
    pub duration: Option<i32>,
    pub season: Option<String>,
    pub season_year: Option<i32>,
    /// Ano de início. Mangá não tem `season_year`; o filtro de ano usa este.
    pub start_year: Option<i32>,
    pub average_score: Option<i32>,
    pub genres: Vec<String>,
    pub is_adult: bool,
    pub country_of_origin: Option<String>,
    pub cover_url: Option<String>,
    pub cover_color: Option<String>,
    pub banner_url: Option<String>,
    pub site_url: Option<String>,
    pub next_airing_episode: Option<i32>,
    pub next_airing_at: Option<DateTime<Utc>>,
    pub anilist_updated_at: Option<DateTime<Utc>>,
    pub synced_at: DateTime<Utc>,
    #[serde(skip)]
    pub search_text: String,
    /// Quando a sinopse e o banner foram buscados. `None` = a obra só veio de lista ou busca.
    #[serde(skip)]
    pub details_synced_at: Option<DateTime<Utc>>,
    /// Origem (`MANGA`, `ORIGINAL`, `LIGHT_NOVEL`…). Daqui para baixo, só o detalhe traz.
    pub source: Option<String>,
    pub studios: Vec<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub external_links: Json<Vec<ExternalLink>>,
    pub relations: Json<Vec<Relation>>,
}

/// Link externo do AniList (site oficial, redes, streaming).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalLink {
    pub site: String,
    pub url: String,
    /// `STREAMING`, `INFO` ou `SOCIAL`.
    pub kind: Option<String>,
    pub language: Option<String>,
}

/// Obra relacionada (continuação, origem, spin-off…).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Relation {
    pub relation_type: String,
    pub id: i64,
    pub media_type: String,
    pub format: Option<String>,
    pub status: Option<String>,
    pub title: String,
    pub cover_url: Option<String>,
}

/// Data parcial do AniList: sem dia ou mês, cai no primeiro.
fn partial_date(date: Option<anilist::FuzzyDate>) -> Option<NaiveDate> {
    let date = date?;
    NaiveDate::from_ymd_opt(date.year?, date.month.unwrap_or(1), date.day.unwrap_or(1))
}

impl Media {
    /// Total de episódios (anime) ou capítulos (mangá), quando o AniList sabe.
    pub fn total_units(&self) -> Option<i32> {
        if self.media_type == "ANIME" {
            self.episodes
        } else {
            self.chapters
        }
    }
}

pub fn timestamp(seconds: Option<i64>) -> Option<DateTime<Utc>> {
    seconds.and_then(|seconds| Utc.timestamp_opt(seconds, 0).single())
}

/// Todos os títulos e sinônimos em minúsculas, numa string só, para o índice trigram.
pub fn build_search_text(titles: &[Option<&str>], synonyms: &[String]) -> String {
    titles
        .iter()
        .flatten()
        .copied()
        .chain(synonyms.iter().map(String::as_str))
        .map(str::trim)
        .filter(|title| !title.is_empty())
        .map(str::to_lowercase)
        .collect::<Vec<_>>()
        .join(" | ")
}

impl From<anilist::Media> for Media {
    fn from(media: anilist::Media) -> Self {
        let synonyms: Vec<String> = media.synonyms.into_iter().flatten().collect();
        let title_user_preferred = media
            .title
            .user_preferred
            .clone()
            .or_else(|| media.title.romaji.clone())
            .or_else(|| media.title.english.clone())
            .unwrap_or_else(|| format!("#{}", media.id));
        let search_text = build_search_text(
            &[
                media.title.romaji.as_deref(),
                media.title.english.as_deref(),
                media.title.native.as_deref(),
                Some(title_user_preferred.as_str()),
            ],
            &synonyms,
        );
        let cover = media.cover_image.unwrap_or(anilist::CoverImage {
            extra_large: None,
            large: None,
            color: None,
        });

        Self {
            id: media.id,
            id_mal: media.id_mal,
            media_type: media.media_type,
            format: media.format,
            status: media.status,
            title_romaji: media.title.romaji,
            title_english: media.title.english,
            title_native: media.title.native,
            title_user_preferred,
            synonyms,
            description: media.description,
            episodes: media.episodes,
            chapters: media.chapters,
            volumes: media.volumes,
            duration: media.duration,
            season: media.season,
            season_year: media.season_year,
            start_year: media.start_date.and_then(|date| date.year),
            average_score: media.average_score,
            genres: media.genres.into_iter().flatten().collect(),
            is_adult: media.is_adult.unwrap_or(false),
            country_of_origin: media.country_of_origin,
            cover_url: cover.extra_large.or(cover.large),
            cover_color: cover.color,
            banner_url: media.banner_image,
            site_url: media.site_url,
            next_airing_episode: media.next_airing_episode.as_ref().map(|next| next.episode),
            next_airing_at: timestamp(media.next_airing_episode.map(|next| next.airing_at)),
            anilist_updated_at: timestamp(media.updated_at),
            synced_at: Utc::now(),
            search_text,
            details_synced_at: None,
            source: media.source,
            studios: media
                .studios
                .map(|studios| {
                    studios.nodes.into_iter().flatten().map(|studio| studio.name).collect()
                })
                .unwrap_or_default(),
            start_date: partial_date(media.start_date),
            end_date: partial_date(media.end_date),
            external_links: Json(
                media
                    .external_links
                    .into_iter()
                    .flatten()
                    .filter_map(|link| {
                        Some(ExternalLink {
                            site: link.site,
                            url: link.url?,
                            kind: link.kind,
                            language: link.language,
                        })
                    })
                    .collect(),
            ),
            relations: Json(
                media
                    .relations
                    .map(|relations| relations.edges.into_iter().flatten().collect::<Vec<_>>())
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|edge| {
                        let node = edge.node?;
                        Some(Relation {
                            relation_type: edge.relation_type.unwrap_or_else(|| "OTHER".into()),
                            id: node.id,
                            media_type: node.media_type,
                            format: node.format,
                            status: node.status,
                            title: node
                                .title
                                .user_preferred
                                .or(node.title.romaji)
                                .unwrap_or_else(|| format!("#{}", node.id)),
                            cover_url: node.cover_image.and_then(|cover| cover.large),
                        })
                    })
                    .collect(),
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_search_text_joins_titles_and_synonyms_in_lowercase() {
        let text = build_search_text(
            &[Some("Sousou no Frieren"), None, Some("  "), Some("Frieren")],
            &["Frieren: Beyond Journey's End".to_string()],
        );
        assert_eq!(text, "sousou no frieren | frieren | frieren: beyond journey's end");
    }
}
