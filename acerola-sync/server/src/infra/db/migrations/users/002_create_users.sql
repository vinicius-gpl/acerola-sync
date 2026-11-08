-- O dono da instância (uso pessoal: uma linha só). O `id` é o mesmo do usuário no AniList.
-- O token do AniList fica criptografado com AES-256-GCM; a chave mora no `ENCRYPTION_KEY`.
CREATE TABLE users (
    id                    BIGINT      PRIMARY KEY,
    name                  TEXT        NOT NULL,
    avatar_url            TEXT,
    site_url              TEXT,
    anilist_token_cipher  BYTEA       NOT NULL,
    anilist_token_nonce   BYTEA       NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessões da extensão. Só o hash SHA-256 do token fica no banco.
CREATE TABLE sessions (
    id            BIGSERIAL   PRIMARY KEY,
    user_id       BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash    BYTEA       NOT NULL UNIQUE,
    device        TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at    TIMESTAMPTZ
);
