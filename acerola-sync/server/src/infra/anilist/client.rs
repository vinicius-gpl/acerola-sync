use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};

use reqwest::{header, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use tokio::{sync::Mutex, time::Instant};

use super::{queries, types::*};
use crate::infra::error::AnilistError;

pub const DEFAULT_API_URL: &str = "https://graphql.anilist.co";

/// Espaço mínimo entre duas chamadas: 30 por minuto, um terço do limite normal do AniList
/// (90/min) e igual ao limite de quando ele está degradado.
const MIN_SPACING: Duration = Duration::from_secs(2);

/// Fila única do processo: cada chamada espera a vez, e um 429 empurra a vez de todo mundo.
#[derive(Debug)]
struct RateGate {
    next_allowed: Mutex<Instant>,
    spacing: Duration,
}

impl RateGate {
    async fn wait(&self) {
        let mut next_allowed = self.next_allowed.lock().await;
        let now = Instant::now();
        if *next_allowed > now {
            tokio::time::sleep_until(*next_allowed).await;
        }
        *next_allowed = Instant::now() + self.spacing;
    }

    async fn pause(&self, duration: Duration) {
        let mut next_allowed = self.next_allowed.lock().await;
        *next_allowed = Instant::now() + duration;
    }
}

#[derive(Debug, Clone)]
pub struct AnilistClient {
    http: reqwest::Client,
    api_url: String,
    gate: Arc<RateGate>,
    /// Quantos requests este processo já fez. O sync guarda a diferença em `sync_runs`.
    requests: Arc<AtomicU64>,
}

impl AnilistClient {
    pub fn new(api_url: impl Into<String>) -> Self {
        Self::with_spacing(api_url, MIN_SPACING)
    }

    /// Os testes usam um espaçamento zero para não esperar 2 s entre chamadas.
    pub fn with_spacing(api_url: impl Into<String>, spacing: Duration) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(concat!("acerola-sync/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("Erro ao criar o cliente HTTP do AniList");

        Self {
            http,
            api_url: api_url.into(),
            gate: Arc::new(RateGate { next_allowed: Mutex::new(Instant::now()), spacing }),
            requests: Arc::new(AtomicU64::new(0)),
        }
    }

    async fn request<T: DeserializeOwned>(
        &self, token: Option<&str>, query: &str, variables: Value,
    ) -> Result<T, AnilistError> {
        self.gate.wait().await;
        self.requests.fetch_add(1, Ordering::Relaxed);

        let mut builder = self
            .http
            .post(&self.api_url)
            .header(header::ACCEPT, "application/json")
            .json(&json!({ "query": query, "variables": variables }));
        if let Some(token) = token {
            builder = builder.bearer_auth(token);
        }

        let response = builder.send().await?;
        let status = response.status();

        if status == StatusCode::TOO_MANY_REQUESTS {
            let retry_after_secs = response
                .headers()
                .get(header::RETRY_AFTER)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(60);
            tracing::warn!("[Anilist] Rate limited, pausing for {}s", retry_after_secs);
            self.gate.pause(Duration::from_secs(retry_after_secs)).await;
            return Err(AnilistError::RateLimited { retry_after_secs });
        }

        if status == StatusCode::UNAUTHORIZED {
            return Err(AnilistError::Unauthorized);
        }

        let body = response.text().await?;
        let parsed: GraphQlResponse<T> = match serde_json::from_str(&body) {
            Ok(parsed) => parsed,
            Err(error) if status.is_success() => {
                return Err(AnilistError::Decode(error.to_string()));
            },
            Err(_) => {
                return Err(AnilistError::Http {
                    status: status.as_u16(),
                    message: truncate(&body, 200),
                });
            },
        };

        let errors = parsed.errors.unwrap_or_default();
        // O AniList responde 400 com "Invalid token" quando o token expirou ou foi revogado.
        if errors.iter().any(|error| error.status == Some(401) || error.message == "Invalid token")
        {
            return Err(AnilistError::Unauthorized);
        }

        match parsed.data {
            Some(data) if errors.is_empty() || status.is_success() => Ok(data),
            _ if status.is_server_error() => {
                Err(AnilistError::Http { status: status.as_u16(), message: join_errors(&errors) })
            },
            _ if !errors.is_empty() => Err(AnilistError::GraphQl(join_errors(&errors))),
            _ => Err(AnilistError::Http { status: status.as_u16(), message: "empty".into() }),
        }
    }

    pub fn requests_made(&self) -> u64 {
        self.requests.load(Ordering::Relaxed)
    }

    pub async fn viewer(&self, token: &str) -> Result<Viewer, AnilistError> {
        let data: ViewerData = self.request(Some(token), &queries::viewer(), json!({})).await?;
        Ok(data.viewer)
    }

    /// A lista inteira do usuário de um tipo (`ANIME`/`MANGA`), juntando todos os pedaços.
    pub async fn media_list(
        &self, token: &str, user_id: i64, media_type: &str,
    ) -> Result<Vec<MediaListEntry>, AnilistError> {
        let query = queries::media_list_collection();
        let mut entries = Vec::new();
        let mut chunk = 1;

        loop {
            let data: MediaListCollectionData = self
                .request(
                    Some(token),
                    &query,
                    json!({ "userId": user_id, "type": media_type, "chunk": chunk }),
                )
                .await?;

            let Some(collection) = data.media_list_collection else { break };
            entries.extend(
                collection
                    .lists
                    .into_iter()
                    .flatten()
                    .flat_map(|group| group.entries.into_iter().flatten()),
            );

            if !collection.has_next_chunk {
                break;
            }
            chunk += 1;
        }

        // Uma obra pode aparecer em mais de uma lista personalizada.
        entries.sort_by_key(|entry| entry.media.id);
        entries.dedup_by_key(|entry| entry.media.id);
        Ok(entries)
    }

    /// Uma página das entradas mais recentes (anime e mangá juntos). `page` começa em 1.
    pub async fn recently_updated(
        &self, token: &str, user_id: i64, page: u32,
    ) -> Result<(Vec<MediaListEntry>, bool), AnilistError> {
        let data: EntryPageData = self
            .request(
                Some(token),
                &queries::recently_updated_entries(),
                json!({ "userId": user_id, "page": page, "perPage": queries::PAGE_SIZE }),
            )
            .await?;
        let entries = data.page.media_list.into_iter().flatten().collect();
        Ok((entries, data.page.page_info.has_next_page))
    }

    /// Próximo episódio das obras em lançamento, até 50 por chamada.
    pub async fn airing(&self, token: &str, ids: &[i64]) -> Result<Vec<AiringInfo>, AnilistError> {
        let data: AiringData = self
            .request(
                Some(token),
                &queries::airing_by_ids(),
                json!({ "ids": ids, "perPage": queries::PAGE_SIZE }),
            )
            .await?;
        Ok(data.page.media.into_iter().flatten().collect())
    }

    pub async fn save_entry(
        &self, token: &str, variables: Value,
    ) -> Result<MediaListEntry, AnilistError> {
        let data: SaveMediaListEntryData =
            self.request(Some(token), &queries::save_media_list_entry(), variables).await?;
        Ok(data.save_media_list_entry)
    }

    pub async fn delete_entry(&self, token: &str, entry_id: i64) -> Result<bool, AnilistError> {
        let data: DeleteMediaListEntryData = self
            .request(Some(token), &queries::delete_media_list_entry(), json!({ "id": entry_id }))
            .await?;
        Ok(data.delete_media_list_entry.and_then(|deleted| deleted.deleted).unwrap_or(false))
    }

    pub async fn search(
        &self, token: Option<&str>, search: &str, media_type: &str, per_page: u32,
    ) -> Result<Vec<Media>, AnilistError> {
        let data: SearchMediaData = self
            .request(
                token,
                &queries::search_media(),
                json!({ "search": search, "type": media_type, "perPage": per_page }),
            )
            .await?;
        Ok(data.page.media.into_iter().flatten().collect())
    }

    /// A obra completa e a entrada do usuário nela (`media_list_entry`), num request só.
    pub async fn media_with_entry(&self, token: &str, id: i64) -> Result<Media, AnilistError> {
        let data: MediaByIdData =
            self.request(Some(token), &queries::media_with_entry(), json!({ "id": id })).await?;
        data.media.ok_or_else(|| AnilistError::GraphQl("Media not found".into()))
    }

    pub async fn media_by_id(&self, token: Option<&str>, id: i64) -> Result<Media, AnilistError> {
        let data: MediaByIdData =
            self.request(token, &queries::media_by_id(), json!({ "id": id })).await?;
        data.media.ok_or_else(|| AnilistError::GraphQl("Media not found".into()))
    }
}

fn join_errors(errors: &[GraphQlError]) -> String {
    errors.iter().map(|error| error.message.as_str()).collect::<Vec<_>>().join("; ")
}

fn truncate(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}
