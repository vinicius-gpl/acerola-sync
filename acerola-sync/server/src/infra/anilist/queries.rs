//! Queries and mutations used by the server.
//!
//! AniList limits by complexity and by number of requests, so each query asks only for what
//! the screen uses:
//! - `LIST_MEDIA_FIELDS`: the minimum for list, filters, search and tracking (no synopsis, no
//!   banner).
//! - `DETAIL_MEDIA_FIELDS`: the rest, requested only once when the media is opened.
//! - `AIRING_FIELDS`: only the next episode, to update what is airing.

const LIST_MEDIA_FIELDS: &str = r#"
    id idMal type format status episodes chapters volumes duration seasonYear averageScore
    genres synonyms siteUrl isAdult updatedAt startDate { year }
    title { romaji english native userPreferred }
    coverImage { large color }
    nextAiringEpisode { episode airingAt }
"#;

const DETAIL_MEDIA_FIELDS: &str = r#"
    id idMal type format status episodes chapters volumes duration season seasonYear
    averageScore genres synonyms siteUrl isAdult countryOfOrigin updatedAt source(version: 3)
    startDate { year month day } endDate { year month day }
    studios(isMain: true) { nodes { name } }
    externalLinks { site url type language }
    relations { edges { relationType(version: 2) node {
        id type format status title { userPreferred } coverImage { large }
    } } }
    description(asHtml: false)
    title { romaji english native userPreferred }
    coverImage { extraLarge large color }
    bannerImage
    nextAiringEpisode { episode airingAt }
"#;

const ENTRY_FIELDS: &str = r#"
    id status progress progressVolumes score(format: POINT_100) repeat private notes updatedAt
    startedAt { year month day }
    completedAt { year month day }
"#;

/// Incremental sync page size (AniList's maximum).
pub const PAGE_SIZE: u32 = 50;

pub fn viewer() -> String {
    "query { Viewer { id name siteUrl avatar { large } } }".to_string()
}

/// The whole list of one type, in chunks of 500 entries (`chunk` starts at 1).
pub fn media_list_collection() -> String {
    format!(
        "query ($userId: Int, $type: MediaType, $chunk: Int) {{
            MediaListCollection(userId: $userId, type: $type, chunk: $chunk, perChunk: 500) {{
                hasNextChunk
                lists {{ entries {{ {ENTRY_FIELDS} media {{ {LIST_MEDIA_FIELDS} }} }} }}
            }}
        }}"
    )
}

/// Entries (anime and manga together) from newest to oldest. The incremental sync stops at the
/// first one that has not changed since the last pull: usually 1 request.
pub fn recently_updated_entries() -> String {
    format!(
        "query ($userId: Int, $page: Int, $perPage: Int) {{
            Page(page: $page, perPage: $perPage) {{
                pageInfo {{ hasNextPage }}
                mediaList(userId: $userId, sort: UPDATED_TIME_DESC) {{
                    {ENTRY_FIELDS} media {{ {LIST_MEDIA_FIELDS} }}
                }}
            }}
        }}"
    )
}

/// Only the next episode of airing media, 50 per request.
pub fn airing_by_ids() -> String {
    "query ($ids: [Int], $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
            media(id_in: $ids) { id status episodes nextAiringEpisode { episode airingAt } }
        }
    }"
    .to_string()
}

pub fn save_media_list_entry() -> String {
    format!(
        "mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $progressVolumes: Int,
                   $scoreRaw: Int, $notes: String, $private: Boolean,
                   $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput) {{
            SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress,
                               progressVolumes: $progressVolumes, scoreRaw: $scoreRaw,
                               notes: $notes, private: $private,
                               startedAt: $startedAt, completedAt: $completedAt) {{
                {ENTRY_FIELDS} media {{ {LIST_MEDIA_FIELDS} }}
            }}
        }}"
    )
}

pub fn delete_media_list_entry() -> String {
    "mutation ($id: Int) { DeleteMediaListEntry(id: $id) { deleted } }".to_string()
}

pub fn search_media() -> String {
    format!(
        "query ($search: String, $type: MediaType, $perPage: Int) {{
            Page(page: 1, perPage: $perPage) {{
                media(search: $search, type: $type, sort: SEARCH_MATCH) {{ {LIST_MEDIA_FIELDS} }}
            }}
        }}"
    )
}

pub fn media_by_id() -> String {
    format!("query ($id: Int) {{ Media(id: $id) {{ {DETAIL_MEDIA_FIELDS} }} }}")
}

/// The whole media and the user's entry on it, in a single request (the media's "sync" button).
pub fn media_with_entry() -> String {
    format!(
        "query ($id: Int) {{ Media(id: $id) {{ {DETAIL_MEDIA_FIELDS} mediaListEntry {{ {ENTRY_FIELDS} }} }} }}"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lista_e_busca_nao_pedem_sinopse_nem_banner() {
        for query in [media_list_collection(), recently_updated_entries(), search_media()] {
            assert!(!query.contains("description"), "{query}");
            assert!(!query.contains("bannerImage"), "{query}");
            assert!(!query.contains("extraLarge"), "{query}");
        }
    }

    #[test]
    fn test_detalhe_pede_sinopse_e_banner() {
        let query = media_by_id();
        assert!(query.contains("description"));
        assert!(query.contains("bannerImage"));
    }

    #[test]
    fn test_incremental_ordena_pelo_mais_recente() {
        assert!(recently_updated_entries().contains("UPDATED_TIME_DESC"));
    }
}
