-- Espelho da lista do usuário no AniList. `dirty` marca o que mudou aqui e ainda não chegou
-- no AniList (API fora do ar, rate limit): o worker reenvia e o sync envia antes de puxar.
CREATE TABLE entries (
    user_id             BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    media_id            BIGINT      NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    anilist_entry_id    BIGINT,
    status              TEXT        NOT NULL CHECK (status IN ('CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING')),
    progress            INTEGER     NOT NULL DEFAULT 0 CHECK (progress >= 0),
    progress_volumes    INTEGER     NOT NULL DEFAULT 0 CHECK (progress_volumes >= 0),
    score               INTEGER     NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    repeat              INTEGER     NOT NULL DEFAULT 0,
    private             BOOLEAN     NOT NULL DEFAULT false,
    notes               TEXT,
    started_at          DATE,
    completed_at        DATE,
    anilist_updated_at  TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    dirty               BOOLEAN     NOT NULL DEFAULT false,
    push_attempts       INTEGER     NOT NULL DEFAULT 0,
    last_push_error     TEXT,
    PRIMARY KEY (user_id, media_id)
);

CREATE INDEX entries_dirty_idx ON entries (user_id) WHERE dirty;
CREATE INDEX entries_status_idx ON entries (user_id, status);
