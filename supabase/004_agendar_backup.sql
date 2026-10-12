-- OPCIONAL — backup diário automático dentro do próprio projeto.
-- Pré-requisito: ativar a extensão pg_cron em Database → Extensions (ou: create extension pg_cron;).
-- Rodar no SQL Editor depois da 002.
select cron.schedule('backup-diario-financeiro', '0 6 * * *', $$select public.fazer_backup()$$);
-- Para conferir:   select * from cron.job;      select dia, criado_em, jsonb_array_length(docs) from public.backups order by dia desc;
-- Para cancelar:   select cron.unschedule('backup-diario-financeiro');
