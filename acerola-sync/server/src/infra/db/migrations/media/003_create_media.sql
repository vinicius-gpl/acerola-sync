-- Espelho das obras do AniList. Tudo que a extensão mostra sai daqui, sem bater no AniList.
CREATE TABLE media (
    id                     BIGINT      PRIMARY KEY,
    id_mal                 BIGINT,
    media_type             TEXT        NOT NULL CHECK (media_type IN ('ANIME', 'MANGA')),
    format                 TEXT,
    status                 TEXT,
    title_romaji           TEXT,
    title_english          TEXT,
    title_native           TEXT,
    title_user_preferred   TEXT        NOT NULL,
    synonyms               TEXT[]      NOT NULL DEFAULT '{}',
    description            TEXT,
    episodes               INTEGER,
    chapters               INTEGER,
    volumes                INTEGER,
    duration               INTEGER,
    season                 TEXT,
    season_year            INTEGER,
    average_score          INTEGER,
    genres                 TEXT[]      NOT NULL DEFAULT '{}',
    is_adult               BOOLEAN     NOT NULL DEFAULT false,
    country_of_origin      TEXT,
    cover_url              TEXT,
    cover_color            TEXT,
    banner_url             TEXT,
    site_url               TEXT,
    next_airing_episode    INTEGER,
    next_airing_at         TIMESTAMPTZ,
    anilist_updated_at     TIMESTAMPTZ,
    synced_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Todos os títulos juntos, para a busca fuzzy com pg_trgm.
    search_text            TEXT        NOT NULL DEFAULT ''
);

CREATE INDEX media_search_text_trgm_idx ON media USING gin (search_text gin_trgm_ops);
CREATE INDEX media_type_idx ON media (media_type);
