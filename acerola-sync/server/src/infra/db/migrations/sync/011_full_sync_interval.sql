-- De quanto em quanto tempo o sync automático puxa a lista inteira (a única forma de ver o
-- que foi apagado no AniList). `0` = só quando o usuário pede.
ALTER TABLE sync_settings ADD COLUMN full_sync_every_hours INTEGER NOT NULL DEFAULT 24
    CHECK (full_sync_every_hours >= 0);
