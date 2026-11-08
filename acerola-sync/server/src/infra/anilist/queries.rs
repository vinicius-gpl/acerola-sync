//! Queries e mutations usadas pelo server.
//!
//! O AniList limita por complexidade e por quantidade de requests, então cada query pede só o
//! que a tela usa:
//! - `LIST_MEDIA_FIELDS`: o mínimo para lista, filtros, busca e tracking (sem sinopse, sem
//!   banner).
//! - `DETAIL_MEDIA_FIELDS`: o resto, pedido uma vez só quando a obra é aberta.
//! - `AIRING_FIELDS`: só o próximo episódio, para atualizar o que está em lançamento.

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

/// Tamanho da página do sync incremental (o máximo do AniList).
pub const PAGE_SIZE: u32 = 50;

pub fn viewer() -> String {
    "query { Viewer { id name siteUrl avatar { large } } }".to_string()
}

/// A lista inteira de um tipo, em pedaços de 500 entradas (`chunk` começa em 1).
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

/// Entradas (anime e mangá juntos) da mais recente para a mais antiga. O sync incremental
/// para na primeira que não mudou desde o último pull — normalmente 1 request.
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

/// Só o próximo episódio das obras em lançamento, 50 por request.
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

/// A obra inteira e a entrada do usuário nela, num request só (botão "sincronizar" da obra).
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
