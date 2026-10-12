\set ON_ERROR_STOP off
\pset pager off
-- ===== preparação =====
insert into public.convites(email,role,colaborador_id) values ('admin@x.com','admin',null),('ana@x.com','colab','u1'),('bia@x.com','colab','u2');
insert into auth.users(id,email) values ('aaaaaaaa-0000-0000-0000-000000000001','admin@x.com'),('c1c1c1c1-0000-0000-0000-000000000001','ana@x.com'),('c2c2c2c2-0000-0000-0000-000000000002','bia@x.com');
select 'perfis' t, email, role, colaborador_id from public.profiles order by email;
-- convite expirado e sem convite
insert into public.convites(email,role,colaborador_id,expira_em) values ('velho@x.com','colab','u9', now()-interval '1 day');
do $$ begin insert into auth.users(email) values ('velho@x.com'); raise notice 'FALHA: convite expirado aceito'; exception when others then raise notice 'OK convite expirado recusado: %', sqlerrm; end $$;
do $$ begin insert into auth.users(email) values ('intruso@x.com'); raise notice 'FALHA: cadastro sem convite aceito'; exception when others then raise notice 'OK sem convite recusado: %', sqlerrm; end $$;

-- ===== admin grava lote =====
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select public.gravar_lote('11111111-1111-1111-1111-111111111111', $j$[
 {"t":"doc","path":"cfg/main","base":null,"data":{"colaboradores":[{"id":"u1","nome":"Ana"},{"id":"u2","nome":"Bia"}],"minhasEmpresas":[{"id":"e1","nome":"ET","cnpj":"11.111.111/0001-11"}]}},
 {"t":"doc","path":"obras/o1","base":null,"data":{"id":"o1","nomeObra":"Obra Segredo","valorContrato":1000000,"servicos":[{"valorTotal":1000000,"imposto":13.5}],"lucro":333333,"equipe":[{"colaboradorId":"u1","pct":10,"etapas":[{"nome":"e1","pct":100,"concluido":false,"aprovado":false}]},{"colaboradorId":"u2","pct":20,"etapas":[{"nome":"e2","pct":100}]}]}},
 {"t":"doc","path":"caixa/m1","base":null,"data":{"id":"m1","valor":777,"colaboradorId":"u2"}},
 {"t":"ficha","cid":"u1","data":{"gerado_em":"2026-10-12","colaborador":{"nome":"Ana","cargo":"Proj","documento":"123"},"valorContrato":1000000,"linhas":[{"obraId":"o1","obra":"Obra Segredo","tipo":"equipe_etapa","equipeIdx":0,"etapaIdx":0,"papel":"Proj — e1","p":100,"val":100000,"pago":0,"saldo":0,"sit":"pendente","concluido":false,"aprovado":false,"imposto":13.5,"lucro":333333,"baixas":[{"id":"b1","data":"2026-10-01","valor":10,"movId":"m1","outroColab":"Bia"}]}]}},
 {"t":"ficha","cid":"u2","data":{"gerado_em":"2026-10-12","colaborador":{"nome":"Bia","cargo":"Proj"},"linhas":[{"obraId":"o1","obra":"Obra Segredo","tipo":"equipe_etapa","equipeIdx":1,"etapaIdx":0,"papel":"Proj — e2","p":100,"val":200000,"pago":0,"saldo":0,"sit":"pendente","baixas":[]}]}}
]$j$::jsonb);
select 'versoes apos 1o lote' t, path, versao from public.docs order by path;
-- idempotência: mesmo op_id de novo não reaplica
select public.gravar_lote('11111111-1111-1111-1111-111111111111', '[{"t":"doc","path":"caixa/m1","base":1,"data":{"id":"m1","valor":1}}]'::jsonb) as repetido;
select 'versao m1 inalterada' t, versao, data->>'valor' valor from public.docs where path='caixa/m1';
-- conflito: base antiga em obras/o1 + caixa novo: nada pode ser aplicado (atômico)
select public.gravar_lote('22222222-2222-2222-2222-222222222222', $j$[{"t":"doc","path":"caixa/m2","base":null,"data":{"id":"m2"}},{"t":"doc","path":"obras/o1","base":99,"data":{"id":"o1"}}]$j$::jsonb);
select 'caixa/m2 nao existe (atomico)' t, count(*) from public.docs where path='caixa/m2';
-- atualização legítima com base correta
select public.gravar_lote('33333333-3333-3333-3333-333333333333', '[{"t":"doc","path":"caixa/m1","base":1,"data":{"id":"m1","valor":778,"colaboradorId":"u2"}}]'::jsonb);
-- caminho inválido
select public.gravar_lote('44444444-4444-4444-4444-444444444444', '[{"t":"doc","path":"../etc","base":null,"data":{}}]'::jsonb);
select 'admin le docs' t, count(*) from public.docs;
select 'admin le auditoria' t, count(*) from public.auditoria;
reset role;

-- ===== cutover (003) =====
\i /home/claude/financeiro-et-projetos/supabase/003_privacidade_cutover.sql

-- ===== Ana (u1) =====
set role authenticated; select set_config('request.jwt.claim.sub','c1c1c1c1-0000-0000-0000-000000000001',false);
select 'ANA le docs' t, count(*) from public.docs;
select 'ANA le fichas' t, count(*) from public.colab_fichas;
select 'ANA le auditoria' t, count(*) from public.auditoria;
select 'ANA le profiles (so a propria)' t, email from public.profiles;
insert into public.docs(path,collection,data) values ('obras/hack','obras','{}');
update public.docs set data='{}' where path='obras/o1';
delete from public.docs;
select public.gravar_lote('55555555-5555-5555-5555-555555555555','[]'::jsonb);
select 'ANA colab_dados' t, public.colab_dados() as r \gset
select :'r' ;
select 'ANA vazamento? (deve ser f)' t, (:'r' ilike '%segredo%contrato%' or :'r' ilike '%valorContrato%' or :'r' ilike '%imposto%' or :'r' ilike '%lucro%' or :'r' ilike '%Bia%' or :'r' ilike '%200000%' or :'r' ilike '%777%' or :'r' ilike '%movId%' or :'r' ilike '%documento%' or :'r' ilike '%outroColab%' or :'r' ilike '%11.111%') as vazou;
select public.marcar_entrega('o1',0,0,true);
select 'ANA marcou propria; sit na ficha' t, public.colab_dados()->'linhas'->0->>'sit' sit, public.colab_dados()->'linhas'->0->>'concluido' concl;
select public.marcar_entrega('o1',1,0,true);
reset role;
select 'obra versao apos marcar' t, versao, data->'equipe'->0->'etapas'->0->>'concluido' concl from public.docs where path='obras/o1';
select 'auditoria da marcacao' t, user_email, operacao from public.auditoria where chave='obras/o1' order by id desc limit 2;

-- ===== Bia (u2) =====
set role authenticated; select set_config('request.jwt.claim.sub','c2c2c2c2-0000-0000-0000-000000000002',false);
select 'BIA colab_dados' t, public.colab_dados() as r2 \gset
select :'r2';
select 'BIA vazamento? (deve ser f)' t, (:'r2' ilike '%Ana%' or :'r2' ilike '%100000%' or :'r2' ilike '%valorContrato%' or :'r2' ilike '%imposto%' or :'r2' ilike '%777%') as vazou;
select public.marcar_entrega('o1',0,0,false);
reset role;

-- ===== anon =====
set role anon;
select count(*) from public.docs;
select public.colab_dados();
reset role;

-- ===== backup / restauração =====
select public.fazer_backup();
select 'backup' t, dia, jsonb_array_length(docs) docs, jsonb_array_length(fichas) fichas from public.backups;
delete from public.docs where path='caixa/m1';
select public.restaurar_backup(current_date);
select 'apos restaurar' t, count(*) from public.docs;
