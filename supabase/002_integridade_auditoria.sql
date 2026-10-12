-- 002 — Integridade, versão por documento, gravação em lote (transação), idempotência,
--        auditoria, backup diário e validade dos convites.
-- ADITIVA: pode ser aplicada com o app antigo em produção.
create extension if not exists pgcrypto with schema extensions;

-- 1) Versão por documento (controle de edição simultânea)
alter table public.docs add column if not exists versao integer not null default 1;

-- 2) Fichas dos colaboradores (dados já resolvidos, sem valores totais de contrato)
create table if not exists public.colab_fichas (
  colaborador_id text primary key,
  data jsonb not null,
  versao integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.colab_fichas enable row level security;
drop policy if exists fichas_admin_ler on public.colab_fichas;
create policy fichas_admin_ler on public.colab_fichas for select to authenticated using (public.is_admin());
-- (sem política para colaborador: ele só lê via colab_dados())

-- 3) Operações já aplicadas (idempotência de gravações repetidas)
create table if not exists public.ops (
  op_id uuid primary key,
  user_id uuid,
  criado_em timestamptz not null default now(),
  resultado jsonb
);
alter table public.ops enable row level security;

-- 4) Auditoria
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  user_id uuid,
  user_email text,
  tabela text not null,
  chave text,
  operacao text not null,
  antes jsonb,
  depois jsonb
);
create index if not exists auditoria_quando_idx on public.auditoria(quando desc);
create index if not exists auditoria_chave_idx on public.auditoria(tabela, chave);
alter table public.auditoria enable row level security;
drop policy if exists auditoria_admin_ler on public.auditoria;
create policy auditoria_admin_ler on public.auditoria for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; em text; v_old jsonb; v_new jsonb;
begin
  select email into em from public.profiles where user_id = auth.uid();
  if tg_table_name = 'docs' then
    k := coalesce(new.path, old.path);
    v_old := case when tg_op in ('UPDATE','DELETE') then old.data end;
    v_new := case when tg_op in ('INSERT','UPDATE') then new.data end;
    if tg_op = 'UPDATE' and v_old is not distinct from v_new then return new; end if;
  elsif tg_table_name = 'profiles' then
    k := coalesce(new.email, old.email);
    v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
    v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  else
    k := coalesce(to_jsonb(new)->>'email', to_jsonb(old)->>'email');
    v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
    v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  end if;
  insert into public.auditoria(user_id, user_email, tabela, chave, operacao, antes, depois)
  values (auth.uid(), coalesce(em, 'sistema'), tg_table_name, k, tg_op, v_old, v_new);
  return coalesce(new, old);
end $$;
revoke all on function public.auditar() from public, anon, authenticated;

drop trigger if exists docs_auditoria on public.docs;
create trigger docs_auditoria after insert or update or delete on public.docs
  for each row execute function public.auditar();
drop trigger if exists profiles_auditoria on public.profiles;
create trigger profiles_auditoria after insert or update or delete on public.profiles
  for each row execute function public.auditar();
drop trigger if exists convites_auditoria on public.convites;
create trigger convites_auditoria after insert or update or delete on public.convites
  for each row execute function public.auditar();

-- 5) Convites com validade
alter table public.convites add column if not exists expira_em timestamptz not null default (now() + interval '7 days');
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from public.convites where email = lower(new.email) and expira_em > now();
  if not found then
    raise exception 'Cadastro não autorizado ou convite expirado. Peça ao administrador para liberar o seu acesso.';
  end if;
  insert into public.profiles(user_id, role, colaborador_id, email)
  values (new.id, c.role, c.colaborador_id, lower(new.email));
  delete from public.convites where email = lower(new.email);
  return new;
end $$;
revoke all on function public.novo_usuario() from public, anon, authenticated;

-- 6) Gravação em lote: tudo-ou-nada, com versão e idempotência
create or replace function public.gravar_lote(p_op uuid, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb; t text; v_path text; v_base int; v_cur int; v_existe boolean; v_del boolean;
  confl text[] := '{}'; vers jsonb := '{}'::jsonb; n int; prev jsonb; v_nova int; v_cid text;
begin
  if not public.is_admin() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_op is null then raise exception 'Identificador da operação ausente'; end if;
  if jsonb_typeof(p_ops) is distinct from 'array' then raise exception 'Lote inválido'; end if;
  if jsonb_array_length(p_ops) > 2000 then raise exception 'Lote grande demais'; end if;

  insert into public.ops(op_id, user_id) values (p_op, auth.uid()) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    select resultado into prev from public.ops where op_id = p_op;
    return coalesce(prev, '{}'::jsonb) || '{"repetido":true}'::jsonb;
  end if;

  -- passo 1: detectar conflitos de versão (bloqueia as linhas)
  for o in select * from jsonb_array_elements(p_ops) loop
    t := o->>'t';
    if t = 'doc' then
      v_path := o->>'path';
      if v_path !~ '^(cfg/main|(obras|caixa|contas)/[A-Za-z0-9_.~:@+-]{1,120})$' then
        raise exception 'Caminho inválido: %', v_path;
      end if;
      v_base := nullif(o->>'base', '')::int;
      v_del := coalesce((o->>'del')::boolean, false);
      select versao into v_cur from public.docs where path = v_path for update;
      v_existe := found;
      if v_del then
        if v_existe and v_cur is distinct from v_base then confl := confl || v_path; end if;
      else
        if v_existe and v_cur is distinct from v_base then confl := confl || v_path;
        elsif not v_existe and v_base is not null then confl := confl || v_path; end if;
      end if;
    elsif t <> 'ficha' then
      raise exception 'Tipo de operação inválido';
    end if;
  end loop;
  if array_length(confl, 1) > 0 then
    raise exception 'CONFLITO|%', array_to_string(confl, ',') using errcode = '40001';
  end if;

  -- passo 2: aplicar
  for o in select * from jsonb_array_elements(p_ops) loop
    t := o->>'t'; v_del := coalesce((o->>'del')::boolean, false);
    if t = 'doc' then
      v_path := o->>'path';
      if v_del then
        delete from public.docs where path = v_path;
        vers := vers || jsonb_build_object(v_path, null);
      else
        insert into public.docs(path, collection, data, versao, updated_at, updated_by)
        values (v_path, split_part(v_path, '/', 1), o->'data', 1, now(), auth.uid())
        on conflict (path) do update
          set data = excluded.data, versao = public.docs.versao + 1, updated_at = now(), updated_by = auth.uid()
        returning versao into v_nova;
        vers := vers || jsonb_build_object(v_path, v_nova);
      end if;
    else
      v_cid := o->>'cid';
      if v_cid is null or length(v_cid) > 120 then raise exception 'Colaborador inválido'; end if;
      if v_del then delete from public.colab_fichas where colaborador_id = v_cid;
      else
        insert into public.colab_fichas(colaborador_id, data, versao, updated_at)
        values (v_cid, o->'data', 1, now())
        on conflict (colaborador_id) do update set data = excluded.data, versao = public.colab_fichas.versao + 1, updated_at = now();
      end if;
    end if;
  end loop;

  prev := jsonb_build_object('versoes', vers);
  update public.ops set resultado = prev where op_id = p_op;
  return prev;
end $$;
revoke all on function public.gravar_lote(uuid, jsonb) from public, anon;
grant execute on function public.gravar_lote(uuid, jsonb) to authenticated;

-- 7) Backup diário dentro do próprio projeto + restauração
create table if not exists public.backups (
  dia date primary key,
  criado_em timestamptz not null default now(),
  docs jsonb not null,
  fichas jsonb not null default '[]'::jsonb
);
alter table public.backups enable row level security;

create or replace function public.fazer_backup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.backups(dia, docs, fichas)
  values (current_date,
          coalesce((select jsonb_agg(jsonb_build_object('path', path, 'data', data, 'versao', versao)) from public.docs), '[]'::jsonb),
          coalesce((select jsonb_agg(jsonb_build_object('cid', colaborador_id, 'data', data)) from public.colab_fichas), '[]'::jsonb))
  on conflict (dia) do update set docs = excluded.docs, fichas = excluded.fichas, criado_em = now();
  delete from public.backups where dia < current_date - 30;
  delete from public.ops where criado_em < now() - interval '30 days';
end $$;
revoke all on function public.fazer_backup() from public, anon, authenticated;

-- Restauração (rodar SOMENTE no SQL Editor, como administrador do projeto):
--   select public.restaurar_backup('2026-10-12');
create or replace function public.restaurar_backup(p_dia date) returns text
language plpgsql security definer set search_path = '' as $$
declare b record; n int;
begin
  select * into b from public.backups where dia = p_dia;
  if not found then raise exception 'Não há backup para %', p_dia; end if;
  perform public.fazer_backup();  -- guarda o estado atual antes de restaurar
  delete from public.docs;
  insert into public.docs(path, collection, data, versao)
    select x->>'path', split_part(x->>'path', '/', 1), x->'data', coalesce((x->>'versao')::int, 1) + 1000
    from jsonb_array_elements(b.docs) x;
  delete from public.colab_fichas;
  insert into public.colab_fichas(colaborador_id, data)
    select x->>'cid', x->'data' from jsonb_array_elements(b.fichas) x;
  get diagnostics n = row_count;
  return 'Restaurado o backup de ' || p_dia || ' (' || jsonb_array_length(b.docs) || ' documentos).';
end $$;
revoke all on function public.restaurar_backup(date) from public, anon, authenticated;
