use serde::Deserialize;

use crate::data::repositories::entries::{EntryFilters, EntrySort};

/// Query string de `/entries` e `/entries/counts`. Listas vão separadas por vírgula
/// (`status=CURRENT,REPEATING`, `genre=Action,Drama`).
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntriesQuery {
    pub media_type: Option<String>,
    pub status: Option<String>,
    /// Trecho do título.
    pub q: Option<String>,
    pub format: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    /// Situação da obra no AniList (`RELEASING`, `FINISHED`…).
    pub media_status: Option<String>,
    pub sort: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

fn split(value: Option<&str>, uppercase: bool) -> Vec<String> {
    value
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(|item| if uppercase { item.to_uppercase() } else { item.to_string() })
        .collect()
}

impl ListEntriesQuery {
    pub fn statuses(&self) -> Vec<String> {
        split(self.status.as_deref(), true)
    }

    pub fn filters(&self) -> EntryFilters {
        EntryFilters {
            media_type: self.media_type.as_deref().map(str::to_uppercase),
            statuses: self.statuses(),
            query: self.q.clone(),
            formats: split(self.format.as_deref(), true),
            // Gênero do AniList tem maiúscula no meio ("Slice of Life"): vai como veio.
            genres: split(self.genre.as_deref(), false),
            year: self.year,
            media_statuses: split(self.media_status.as_deref(), true),
        }
    }

    pub fn sort(&self) -> EntrySort {
        EntrySort::parse(self.sort.as_deref())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FacetsQuery {
    pub media_type: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn teste_filtros_vem_da_query_string() {
        let query = ListEntriesQuery {
            media_type: Some("anime".into()),
            status: Some("current, repeating,".into()),
            format: Some("tv,movie".into()),
            genre: Some("Slice of Life,Drama".into()),
            media_status: Some("releasing".into()),
            sort: Some("SCORE".into()),
            ..Default::default()
        };
        let filters = query.filters();
        assert_eq!(filters.media_type.as_deref(), Some("ANIME"));
        assert_eq!(filters.statuses, ["CURRENT", "REPEATING"]);
        assert_eq!(filters.formats, ["TV", "MOVIE"]);
        assert_eq!(filters.genres, ["Slice of Life", "Drama"]);
        assert_eq!(filters.media_statuses, ["RELEASING"]);
        assert_eq!(query.sort(), EntrySort::Score);
        assert_eq!(ListEntriesQuery::default().sort(), EntrySort::Updated);
    }
}
