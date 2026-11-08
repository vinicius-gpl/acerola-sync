//! Fluxos completos contra um Postgres de verdade e um AniList simulado (wiremock).
//! Rodam com `TEST_DATABASE_URL=postgres://user:pass@host:port/postgres cargo nextest run`.

mod support;

use anyhow::Result;
use axum::http::Method;
use serde_json::json;
use support::*;
use wiremock::{
    matchers::{body_string_contains, method},
    Mock, MockServer, ResponseTemplate,
};

async fn mock_graphql(server: &MockServer, needle: &str, response: ResponseTemplate) {
    Mock::given(method("POST"))
        .and(body_string_contains(needle))
        .respond_with(response)
        .mount(server)
        .await;
}

async fn login(app: &axum::Router) -> String {
    let (status, body) = call(
        app,
        Method::POST,
        "/auth/login",
        None,
        Some(json!({ "accessToken": "anilist-token", "device": "test" })),
    )
    .await;
    assert_eq!(status, 200, "{body}");
    body["sessionToken"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn test_login_mirrors_the_whole_list() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![
            entry(1, "CURRENT", 3, media(100, "ANIME", "Sousou no Frieren", Some(28))),
            entry(2, "PLANNING", 0, media(200, "MANGA", "Chainsaw Man", None)),
        ])),
    )
    .await;

    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    let (status, me) = call(&app, Method::GET, "/me", Some(&token), None).await;
    assert_eq!(status, 200);
    assert_eq!(me["id"], VIEWER_ID);

    let (_, anime) = call(&app, Method::GET, "/entries?mediaType=ANIME", Some(&token), None).await;
    let anime = anime.as_array().unwrap();
    assert_eq!(anime.len(), 1);
    assert_eq!(anime[0]["progress"], 3);
    assert_eq!(anime[0]["media"]["titleUserPreferred"], "Sousou no Frieren");

    // A busca sai do espelho, sem request novo ao AniList.
    let (_, hits) = call(&app, Method::GET, "/media/search?q=frieren", Some(&token), None).await;
    assert_eq!(hits[0]["media"]["id"], 100);
    assert_eq!(hits[0]["source"], "LOCAL");

    // O token do AniList nunca fica em texto puro no banco.
    let (cipher,): (Vec<u8>,) =
        sqlx::query_as("SELECT anilist_token_cipher FROM users").fetch_one(&db.pool).await?;
    assert!(!String::from_utf8_lossy(&cipher).contains("anilist-token"));

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_routes_require_a_session() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    let app = app_with(db.pool.clone(), &anilist);

    let (status, body) = call(&app, Method::GET, "/entries", None, None).await;
    assert_eq!(status, 401);
    assert_eq!(body["errorType"], "unauthorized");

    let (status, _) = call(&app, Method::GET, "/entries", Some("wrong"), None).await;
    assert_eq!(status, 401);

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_second_anilist_user_cannot_take_the_instance() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![])),
    )
    .await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    anilist.reset().await;
    mock_graphql(
        &anilist,
        "Viewer",
        ResponseTemplate::new(200).set_body_json(json!({
            "data": { "Viewer": { "id": 9999, "name": "intruso", "siteUrl": null, "avatar": null } }
        })),
    )
    .await;
    let (status, body) = call(
        &app,
        Method::POST,
        "/auth/login",
        None,
        Some(json!({ "accessToken": "other-token" })),
    )
    .await;
    assert_eq!(status, 403, "{body}");

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_edit_while_anilist_is_down_stays_pending_until_next_sync() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![entry(
            1,
            "CURRENT",
            3,
            media(100, "ANIME", "Sousou no Frieren", Some(28)),
        )])),
    )
    .await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    // AniList fora do ar: a edição vale aqui e fica pendente.
    anilist.reset().await;
    mock_graphql(&anilist, "SaveMediaListEntry", ResponseTemplate::new(503)).await;
    let (status, saved) =
        call(&app, Method::PATCH, "/entries/100", Some(&token), Some(json!({ "progress": 4 })))
            .await;
    assert_eq!(status, 200, "{saved}");
    assert_eq!(saved["pending"], true);
    assert_eq!(saved["progress"], 4);

    let (_, status_body) = call(&app, Method::GET, "/sync/status", Some(&token), None).await;
    assert_eq!(status_body["pendingEntries"], 1);

    // AniList voltou, mas ainda com o valor antigo: o sync envia o pendente antes de puxar.
    anilist.reset().await;
    mock_graphql(
        &anilist,
        "SaveMediaListEntry",
        ResponseTemplate::new(200).set_body_json(json!({ "data": { "SaveMediaListEntry":
            entry(1, "CURRENT", 4, media(100, "ANIME", "Sousou no Frieren", Some(28))) } })),
    )
    .await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![entry(
            1,
            "CURRENT",
            4,
            media(100, "ANIME", "Sousou no Frieren", Some(28)),
        )])),
    )
    .await;
    let body = run_sync(&app, &token, true).await;
    let run = &body["run"];
    assert_eq!(run["status"], "SUCCESS", "{body}");
    assert_eq!(run["entriesPushed"], 1);

    let (_, status_body) = call(&app, Method::GET, "/sync/status", Some(&token), None).await;
    assert_eq!(status_body["pendingEntries"], 0);

    let (_, history) = call(&app, Method::GET, "/history", Some(&token), None).await;
    assert_eq!(history[0]["progress"], 4);
    assert_eq!(history[0]["previous"], 3);

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_sync_removes_entries_deleted_on_anilist() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![
            entry(1, "CURRENT", 3, media(100, "ANIME", "Sousou no Frieren", Some(28))),
            entry(2, "CURRENT", 1, media(101, "ANIME", "Dandadan", Some(12))),
        ])),
    )
    .await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    anilist.reset().await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![entry(
            1,
            "CURRENT",
            3,
            media(100, "ANIME", "Sousou no Frieren", Some(28)),
        )])),
    )
    .await;
    let body = run_sync(&app, &token, true).await;
    assert_eq!(body["run"]["entriesRemoved"], 1, "{body}");

    let (_, anime) = call(&app, Method::GET, "/entries?mediaType=ANIME", Some(&token), None).await;
    assert_eq!(anime.as_array().unwrap().len(), 1);

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_tracking_resolves_by_title_and_never_goes_back() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![entry(
            7,
            "CURRENT",
            10,
            media(300, "MANGA", "Chainsaw Man", None),
        )])),
    )
    .await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    let (status, resolved) = call(
        &app,
        Method::POST,
        "/track/resolve",
        Some(&token),
        Some(json!({ "site": "sakuramangas", "identifier": "chainsaw-man",
                     "title": "Chainsaw Man", "mediaType": "MANGA" })),
    )
    .await;
    assert_eq!(status, 200, "{resolved}");
    assert_eq!(resolved["media"]["id"], 300);
    assert_eq!(resolved["mapping"]["source"], "AUTO");

    // Capítulo antigo: ignora.
    let (_, skipped) = call(
        &app,
        Method::POST,
        "/track/progress",
        Some(&token),
        Some(json!({ "site": "sakuramangas", "mediaId": 300, "progress": 9 })),
    )
    .await;
    assert_eq!(skipped["applied"], false);
    assert_eq!(skipped["skipReason"], "ALREADY_AHEAD");

    // Capítulo novo: envia ao AniList e grava no espelho.
    mock_graphql(
        &anilist,
        "SaveMediaListEntry",
        ResponseTemplate::new(200).set_body_json(json!({ "data": { "SaveMediaListEntry":
            entry(7, "CURRENT", 11, media(300, "MANGA", "Chainsaw Man", None)) } })),
    )
    .await;
    let (_, applied) = call(
        &app,
        Method::POST,
        "/track/progress",
        Some(&token),
        Some(json!({ "site": "sakuramangas", "mediaId": 300, "progress": 11,
                     "url": "https://sakuramangas.org/obras/chainsaw-man/11" })),
    )
    .await;
    assert_eq!(applied["applied"], true, "{applied}");
    assert_eq!(applied["saved"]["progress"], 11);
    assert_eq!(applied["saved"]["pending"], false);

    // Correção manual vence a automática.
    mock_graphql(
        &anilist,
        "Media(id",
        ResponseTemplate::new(200).set_body_json(json!({ "data": { "Media":
            media(301, "MANGA", "Chainsaw Man Part 2", None) } })),
    )
    .await;
    let (status, mapping) = call(
        &app,
        Method::PUT,
        "/track/mapping",
        Some(&token),
        Some(json!({ "site": "sakuramangas", "identifier": "chainsaw-man", "mediaId": 301 })),
    )
    .await;
    assert_eq!(status, 200, "{mapping}");
    assert_eq!(mapping["source"], "MANUAL");
    let (_, resolved) = call(
        &app,
        Method::POST,
        "/track/resolve",
        Some(&token),
        Some(json!({ "site": "sakuramangas", "identifier": "chainsaw-man",
                     "title": "Chainsaw Man", "mediaType": "MANGA" })),
    )
    .await;
    assert_eq!(resolved["media"]["id"], 301);

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_schedule_is_saved_in_utc_without_firing_immediately() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![])),
    )
    .await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    let (status, settings) = call(
        &app,
        Method::PUT,
        "/sync/schedule",
        Some(&token),
        Some(json!({ "enabled": true, "times": ["09:00:00", "21:30:00", "09:00:00"] })),
    )
    .await;
    assert_eq!(status, 200, "{settings}");
    assert_eq!(settings["scheduleEnabled"], true);
    assert_eq!(settings["scheduleTimes"], json!(["09:00:00", "21:30:00"]));
    assert!(settings["lastScheduledSlot"].is_string());

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_custom_sites_validate_the_url_pattern() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![])),
    )
    .await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    let (status, _) = call(
        &app,
        Method::POST,
        "/custom-sites",
        Some(&token),
        Some(json!({ "name": "Leitor", "mediaType": "MANGA",
                     "matchPattern": "https://leitor.exemplo.com/*", "urlPattern": "/obra/(.+)" })),
    )
    .await;
    assert_eq!(status, 400);

    let (status, site) = call(
        &app,
        Method::POST,
        "/custom-sites",
        Some(&token),
        Some(json!({ "name": "Leitor", "mediaType": "MANGA",
                     "matchPattern": "https://leitor.exemplo.com/*",
                     "urlPattern": "/obra/(?<id>[^/]+)/cap/(?<progress>\\d+)" })),
    )
    .await;
    assert_eq!(status, 200, "{site}");
    assert!(site["id"].is_string());

    let (_, sites) = call(&app, Method::GET, "/custom-sites", Some(&token), None).await;
    assert_eq!(sites.as_array().unwrap().len(), 1);

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_second_sync_is_incremental_and_logged() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    let mut airing = media(100, "ANIME", "Dandadan", Some(12));
    airing["status"] = json!("RELEASING");
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![entry(1, "CURRENT", 3, airing)])),
    )
    .await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    // Depois do completo do login, o próximo é incremental: 1 página + 1 de lançamentos.
    let mut changed = entry(1, "CURRENT", 4, media(100, "ANIME", "Dandadan", Some(12)));
    changed["updatedAt"] = json!(chrono::Utc::now().timestamp());
    changed["media"]["status"] = json!("RELEASING");
    mock_graphql(
        &anilist,
        "UPDATED_TIME_DESC",
        ResponseTemplate::new(200).set_body_json(json!({ "data": { "Page": {
            "pageInfo": { "hasNextPage": false }, "mediaList": [changed] } } })),
    )
    .await;
    mock_graphql(
        &anilist,
        "id_in",
        ResponseTemplate::new(200).set_body_json(json!({ "data": { "Page": { "media": [{
            "id": 100, "status": "RELEASING", "episodes": 12,
            "nextAiringEpisode": { "episode": 5, "airingAt": 1_900_000_000 } }] } } })),
    )
    .await;

    let body = run_sync(&app, &token, false).await;
    let run = &body["run"];
    assert_eq!(run["status"], "SUCCESS", "{body}");
    assert_eq!(run["mode"], "INCREMENTAL");
    assert_eq!(run["entriesPulled"], 1);
    assert_eq!(run["anilistRequests"], 2);
    assert!(body["logs"].as_array().unwrap().len() >= 3);

    let (_, anime) = call(&app, Method::GET, "/entries?mediaType=ANIME", Some(&token), None).await;
    assert_eq!(anime[0]["progress"], 4);
    assert_eq!(anime[0]["media"]["nextAiringEpisode"], 5);

    let (_, counts) = call(&app, Method::GET, "/entries/counts", Some(&token), None).await;
    assert_eq!(counts[0]["count"], 1);

    db.drop().await;
    Ok(())
}

#[tokio::test]
async fn test_sync_one_pulls_details_and_entry_and_filters_the_list() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    let mut frieren = media(100, "ANIME", "Sousou no Frieren", Some(28));
    frieren["genres"] = json!(["Adventure", "Drama"]);
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![
            entry(1, "CURRENT", 3, frieren.clone()),
            entry(2, "CURRENT", 1, media(101, "ANIME", "Dandadan", Some(12))),
        ])),
    )
    .await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    // Filtros no server: gênero e busca, na lista e na contagem.
    let (_, drama) =
        call(&app, Method::GET, "/entries?genre=Drama&q=FRIER", Some(&token), None).await;
    assert_eq!(drama.as_array().unwrap().len(), 1, "{drama}");
    let (_, counts) =
        call(&app, Method::GET, "/entries/counts?genre=Drama", Some(&token), None).await;
    assert_eq!(counts[0]["count"], 1, "{counts}");
    let (_, facets) =
        call(&app, Method::GET, "/entries/facets?mediaType=ANIME", Some(&token), None).await;
    assert_eq!(facets["genres"], json!(["Adventure", "Drama"]));

    // O AniList tem a ficha completa e o progresso mais novo.
    let mut detail = frieren;
    detail["source"] = json!("MANGA");
    detail["studios"] = json!({ "nodes": [{ "name": "Madhouse" }] });
    detail["startDate"] = json!({ "year": 2023, "month": 9, "day": null });
    detail["externalLinks"] = json!([
        { "site": "Crunchyroll", "url": "https://www.crunchyroll.com/series/x", "type": "STREAMING", "language": null },
        { "site": "Twitter", "url": null, "type": "SOCIAL", "language": null }
    ]);
    detail["relations"] = json!({ "edges": [{ "relationType": "SOURCE", "node": {
        "id": 300, "type": "MANGA", "format": "MANGA", "status": "RELEASING",
        "title": { "userPreferred": "Frieren (mangá)" }, "coverImage": { "large": null }
    } }] });
    detail["mediaListEntry"] = json!({
        "id": 1, "status": "CURRENT", "progress": 7, "progressVolumes": 0, "score": 90.0,
        "repeat": 0, "private": false, "notes": null, "updatedAt": 1_700_000_100,
        "startedAt": null, "completedAt": null
    });
    anilist.reset().await;
    mock_graphql(
        &anilist,
        "mediaListEntry",
        ResponseTemplate::new(200).set_body_json(json!({ "data": { "Media": detail } })),
    )
    .await;

    let (status, synced) = call(&app, Method::POST, "/entries/100/sync", Some(&token), None).await;
    assert_eq!(status, 200, "{synced}");
    assert_eq!(synced["entry"]["progress"], 7);
    assert_eq!(synced["media"]["studios"], json!(["Madhouse"]));
    assert_eq!(synced["media"]["source"], "MANGA");
    assert_eq!(synced["media"]["startDate"], "2023-09-01");
    assert_eq!(synced["media"]["externalLinks"].as_array().unwrap().len(), 1);
    assert_eq!(synced["media"]["relations"][0]["title"], "Frieren (mangá)");
    assert_eq!(synced["visits"], json!([]));

    // Fora da lista no AniList: some daqui também.
    let mut gone = detail_without_entry(&synced);
    gone["id"] = json!(101);
    anilist.reset().await;
    mock_graphql(
        &anilist,
        "mediaListEntry",
        ResponseTemplate::new(200).set_body_json(json!({ "data": { "Media": gone } })),
    )
    .await;
    let (status, synced) = call(&app, Method::POST, "/entries/101/sync", Some(&token), None).await;
    assert_eq!(status, 200, "{synced}");
    assert!(synced["entry"].is_null());
    let (_, anime) = call(&app, Method::GET, "/entries?mediaType=ANIME", Some(&token), None).await;
    assert_eq!(anime.as_array().unwrap().len(), 1);

    db.drop().await;
    Ok(())
}

fn detail_without_entry(_: &serde_json::Value) -> serde_json::Value {
    let mut media = media(101, "ANIME", "Dandadan", Some(12));
    media["mediaListEntry"] = serde_json::Value::Null;
    media
}

#[tokio::test]
async fn test_full_sync_interval_only_accepts_offered_values() -> Result<()> {
    let Some(db) = TestDb::create().await else { return Ok(()) };
    let anilist = MockServer::start().await;
    mock_graphql(&anilist, "Viewer", ResponseTemplate::new(200).set_body_json(viewer())).await;
    mock_graphql(
        &anilist,
        "MediaListCollection",
        ResponseTemplate::new(200).set_body_json(collection(vec![])),
    )
    .await;
    let app = app_with(db.pool.clone(), &anilist);
    let token = login(&app).await;
    wait_sync_idle(&app, &token).await;

    let (status, _) =
        call(&app, Method::PUT, "/sync/full-interval", Some(&token), Some(json!({ "hours": 5 })))
            .await;
    assert_eq!(status, 400);
    let (status, saved) =
        call(&app, Method::PUT, "/sync/full-interval", Some(&token), Some(json!({ "hours": 0 })))
            .await;
    assert_eq!(status, 200, "{saved}");
    assert_eq!(saved["fullSyncEveryHours"], 0);
    let (_, sync_status) = call(&app, Method::GET, "/sync/status", Some(&token), None).await;
    assert_eq!(sync_status["settings"]["fullSyncEveryHours"], 0);

    db.drop().await;
    Ok(())
}
