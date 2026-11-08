-- Ficha completa da obra (como no MALSync): origem, estúdios, datas, links externos
-- (streaming incluso) e obras relacionadas. Só vêm na query de detalhe.
ALTER TABLE media ADD COLUMN source TEXT;
ALTER TABLE media ADD COLUMN studios TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE media ADD COLUMN start_date DATE;
ALTER TABLE media ADD COLUMN end_date DATE;
ALTER TABLE media ADD COLUMN external_links JSONB NOT NULL DEFAULT '[]';
ALTER TABLE media ADD COLUMN relations JSONB NOT NULL DEFAULT '[]';

-- O detalhe já buscado não tem esses campos: busca de novo (uma vez) quando a obra abrir.
UPDATE media SET details_synced_at = NULL;
