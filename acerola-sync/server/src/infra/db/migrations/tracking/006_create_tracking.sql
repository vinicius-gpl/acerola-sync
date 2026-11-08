-- De qual obra do AniList é a página `identifier` do site `site`. `source` diz se veio da
-- busca automática ou de uma correção manual (a manual nunca é sobrescrita).
CREATE TABLE site_mappings (
    user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    site        TEXT        NOT NULL,
    identifier  TEXT        NOT NULL,
    media_id    BIGINT      NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    title       TEXT        NOT NULL DEFAULT '',
    source      TEXT        NOT NULL CHECK (source IN ('AUTO', 'MANUAL')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, site, identifier)
);

-- Backup de tudo o que foi feito: cada mudança de progresso, de onde veio e quando.
CREATE TABLE history (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    media_id    BIGINT      NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    progress    INTEGER     NOT NULL,
    previous    INTEGER     NOT NULL,
    source      TEXT        NOT NULL,
    url         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX history_user_created_idx ON history (user_id, created_at DESC);

-- Sites personalizados: rastreio pela URL. `url_pattern` é uma regex com os grupos nomeados
-- `id` (obrigatório), `progress` (obrigatório) e `title` (opcional).
CREATE TABLE custom_sites (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    media_type      TEXT        NOT NULL CHECK (media_type IN ('ANIME', 'MANGA')),
    match_pattern   TEXT        NOT NULL,
    url_pattern     TEXT        NOT NULL,
    title_selector  TEXT,
    enabled         BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
