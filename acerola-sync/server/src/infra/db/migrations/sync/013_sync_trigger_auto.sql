-- Sync automático do server: de hora em hora puxa o que mudou (e a lista inteira quando passa
-- do intervalo escolhido), sem precisar de horário na agenda.
ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_trigger_check;
ALTER TABLE sync_runs
    ADD CONSTRAINT sync_runs_trigger_check CHECK (trigger IN ('MANUAL', 'SCHEDULED', 'LOGIN', 'AUTO'));
