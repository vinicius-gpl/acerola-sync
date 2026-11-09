-- De onde sai o número do capítulo/episódio do site personalizado: da URL (padrão), do título
-- da página ou de um elemento (seletor CSS). Fora da URL, `progress_pattern` (opcional) tira o
-- número do texto lido.
ALTER TABLE custom_sites
    ADD COLUMN progress_source   TEXT NOT NULL DEFAULT 'url'
        CHECK (progress_source IN ('url', 'title', 'selector')),
    ADD COLUMN progress_selector TEXT,
    ADD COLUMN progress_pattern  TEXT;
