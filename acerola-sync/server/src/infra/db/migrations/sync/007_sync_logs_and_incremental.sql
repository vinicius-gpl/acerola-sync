-- Sync incremental: na maioria das vezes só o que mudou desde `last_pull_at` é puxado. A
-- lista inteira (que detecta o que foi apagado no AniList) roda no máximo 1x por dia.
ALTER TABLE sync_settings ADD COLUMN last_pull_at TIMESTAMPTZ;
ALTER TABLE sync_settings ADD COLUMN last_full_sync_at TIMESTAMPTZ;

ALTER TABLE sync_runs ADD COLUMN mode TEXT NOT NULL DEFAULT 'FULL'
    CHECK (mode IN ('FULL', 'INCREMENTAL'));
ALTER TABLE sync_runs ADD COLUMN anilist_requests INTEGER NOT NULL DEFAULT 0;

-- A lista e a busca usam campos leves; a sinopse só vem quando a obra é aberta, uma vez.
ALTER TABLE media ADD COLUMN details_synced_at TIMESTAMPTZ;

-- Linha a linha do que o sync está fazendo, para a tela de logs acompanhar ao vivo.
CREATE TABLE sync_logs (
    id          BIGSERIAL   PRIMARY KEY,
    run_id      BIGINT      NOT NULL REFERENCES sync_runs (id) ON DELETE CASCADE,
    level       TEXT        NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
    message     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sync_logs_run_idx ON sync_logs (run_id, id);
