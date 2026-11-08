-- Filtros da lista: ano de início (mangá não tem `season_year`) e gêneros, que agora vêm na
-- query leve. Os índices cobrem os filtros que mais cortam linhas.
ALTER TABLE media ADD COLUMN start_year INTEGER;

CREATE INDEX media_genres_idx ON media USING gin (genres);
CREATE INDEX media_format_idx ON media (format);
