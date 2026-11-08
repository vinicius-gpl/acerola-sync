use serde::Serialize;

use crate::{
    bios::state::AppState,
    data::{
        models::{entry::Entry, media::Media, user::User},
        repositories::{entries as entry_repository, media as media_repository},
    },
    infra::error::AppError,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub media: Media,
    pub entry: Option<Entry>,
    /// `LOCAL` veio do espelho; `ANILIST` precisou de 1 request (e agora já está no espelho).
    pub source: &'static str,
}

/// Busca primeiro no espelho. Só vai ao AniList se pedido (`remote`) ou se nada foi achado.
pub async fn search(
    state: &AppState, user: &User, query: &str, media_type: Option<&str>, remote: bool,
) -> Result<Vec<SearchHit>, AppError> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(vec![]);
    }

    let local = media_repository::search(&state.database_pool, query, media_type, 30).await?;
    let mut hits = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for scored in local {
        seen.insert(scored.media.id);
        hits.push((scored.media, "LOCAL"));
    }

    if remote || hits.is_empty() {
        let token = state.anilist_token(user)?;
        let types: Vec<&str> = media_type.map(|kind| vec![kind]).unwrap_or(vec!["ANIME", "MANGA"]);
        for kind in types {
            match state.anilist.search(Some(&token), query, kind, 10).await {
                Ok(results) => {
                    for media in results.into_iter().map(Media::from) {
                        media_repository::upsert(&state.database_pool, &media).await?;
                        if seen.insert(media.id) {
                            hits.push((media, "ANILIST"));
                        }
                    }
                },
                // Sem AniList a busca local continua valendo.
                Err(error) if error.is_transient() && !hits.is_empty() => {
                    tracing::warn!("[Search] AniList unavailable: {}", error);
                },
                Err(error) => return Err(error.into()),
            }
        }
    }

    // Uma query para todas as entradas, não uma por resultado.
    let ids: Vec<i64> = hits.iter().map(|(media, _)| media.id).collect();
    let mut entries: std::collections::HashMap<i64, Entry> =
        entry_repository::find_many(&state.database_pool, user.id, &ids)
            .await?
            .into_iter()
            .map(|entry| (entry.media_id, entry))
            .collect();

    Ok(hits
        .into_iter()
        .map(|(media, source)| {
            let entry = entries.remove(&media.id);
            SearchHit { media, entry, source }
        })
        .collect())
}
