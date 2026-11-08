-- Endereço de busca do site personalizado, com `{title}` no lugar do título. A tela da obra
-- usa para o botão "abrir no site".
ALTER TABLE custom_sites ADD COLUMN search_url TEXT;
