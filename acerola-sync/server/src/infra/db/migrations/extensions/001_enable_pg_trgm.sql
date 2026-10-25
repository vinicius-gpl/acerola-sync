-- Busca fuzzy de títulos direto no Postgres, sem gastar request no AniList.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
