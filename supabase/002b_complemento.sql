-- 002b — complemento da 002: só o que o conector não conseguiu aplicar (auditoria por gatilhos, validade do convite, backup/restauração).
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
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
