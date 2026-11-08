-- Horários do sync agendado, sempre em UTC. A tela mostra e converte para o horário de SP.
CREATE TABLE sync_settings (
    user_id              BIGINT      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    schedule_enabled     BOOLEAN     NOT NULL DEFAULT false,
    schedule_times       TIME[]      NOT NULL DEFAULT '{}',
    -- Último horário agendado já atendido; evita rodar duas vezes o mesmo horário.
    last_scheduled_slot  TIMESTAMPTZ,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_runs (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    trigger         TEXT        NOT NULL CHECK (trigger IN ('MANUAL', 'SCHEDULED', 'LOGIN')),
    status          TEXT        NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    entries_pulled  INTEGER     NOT NULL DEFAULT 0,
    entries_pushed  INTEGER     NOT NULL DEFAULT 0,
    entries_removed INTEGER     NOT NULL DEFAULT 0,
    error           TEXT
);

CREATE INDEX sync_runs_user_started_idx ON sync_runs (user_id, started_at DESC);
