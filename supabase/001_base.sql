-- Financeiro ET: tabelas, permissões e funções. Rodar uma vez no SQL Editor do Supabase.
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','colab')),
  colaborador_id text,
  email text not null,
  criado_em timestamptz not null default now()
);
create unique index profiles_colab_uni on public.profiles(colaborador_id) where colaborador_id is not null;

create table public.convites (
  email text primary key,
  role text not null check (role in ('admin','colab')),
  colaborador_id text,
  criado_em timestamptz not null default now()
);

create table public.docs (
  path text primary key,
  collection text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index docs_collection_idx on public.docs(collection);

alter table public.profiles enable row level security;
alter table public.convites enable row level security;
alter table public.docs enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where user_id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy profiles_ler on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy docs_admin_all on public.docs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- só entra no sistema quem foi convidado pelo administrador
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from public.convites where email = lower(new.email);
  if not found then
    raise exception 'Cadastro não autorizado. Peça ao administrador para liberar o seu acesso.';
  end if;
  insert into public.profiles(user_id, role, colaborador_id, email)
  values (new.id, c.role, c.colaborador_id, lower(new.email));
  delete from public.convites where email = lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.novo_usuario();

-- visão restrita do colaborador: só as próprias entregas e pagamentos
create or replace function public.colab_dados() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cid text; cfg jsonb; r jsonb := '[]'::jsonb; o record; d jsonb;
begin
  select colaborador_id into cid from public.profiles where user_id = auth.uid() and role = 'colab';
  if cid is null then raise exception 'Sem acesso'; end if;
  select data into cfg from public.docs where path = 'cfg/main';
  cfg := coalesce(cfg, '{}'::jsonb);
  r := r || jsonb_build_array(jsonb_build_object('path','cfg/main','data', jsonb_build_object(
    'tiposServico', coalesce(cfg->'tiposServico','[]'::jsonb),
    'minhasEmpresas', coalesce(cfg->'minhasEmpresas','[]'::jsonb),
    'colaboradores', coalesce((select jsonb_agg(c) from jsonb_array_elements(coalesce(cfg->'colaboradores','[]'::jsonb)) c where c->>'id' = cid),'[]'::jsonb),
    'historico','[]'::jsonb, 'incc','[]'::jsonb, 'despesasFixas','[]'::jsonb)));
  for o in select path, data from public.docs where collection = 'obras' loop
    if exists(select 1 from jsonb_array_elements(coalesce(o.data->'equipe','[]'::jsonb)) m where m->>'colaboradorId' = cid)
       or exists(select 1 from jsonb_array_elements(coalesce(o.data->'despesasObra','[]'::jsonb)) x where x->>'colaboradorId' = cid) then
      d := o.data;
      d := jsonb_set(d, '{equipe}', coalesce((
        select jsonb_agg(case when m->>'colaboradorId' = cid then m
                              else jsonb_build_object('colaboradorId','__','etapas','[]'::jsonb,'pct',0) end order by ord)
        from jsonb_array_elements(coalesce(o.data->'equipe','[]'::jsonb)) with ordinality t(m, ord)),'[]'::jsonb));
      d := jsonb_set(d, '{despesasObra}', coalesce((
        select jsonb_agg(x) from jsonb_array_elements(coalesce(o.data->'despesasObra','[]'::jsonb)) x where x->>'colaboradorId' = cid),'[]'::jsonb));
      d := jsonb_set(d, '{cliente}', jsonb_build_object('nome', coalesce(o.data->'cliente'->>'nome','')));
      r := r || jsonb_build_array(jsonb_build_object('path', o.path, 'data', d));
    end if;
  end loop;
  for o in select path, data from public.docs where collection = 'caixa' and data->>'colaboradorId' = cid loop
    r := r || jsonb_build_array(jsonb_build_object('path', o.path, 'data', o.data));
  end loop;
  return r;
end $$;
revoke all on function public.colab_dados() from public, anon;
grant execute on function public.colab_dados() to authenticated;

-- única escrita do colaborador: marcar a própria entrega como concluída
create or replace function public.marcar_entrega(p_obra text, p_mi int, p_ei int, p_concluido boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare cid text; o jsonb; it jsonb;
begin
  select colaborador_id into cid from public.profiles where user_id = auth.uid() and role = 'colab';
  if cid is null then raise exception 'Sem acesso'; end if;
  select data into o from public.docs where path = 'obras/' || p_obra for update;
  if o is null then raise exception 'Obra não encontrada'; end if;
  if o->'equipe'->p_mi->>'colaboradorId' is distinct from cid then raise exception 'Entrega de outra pessoa'; end if;
  it := o->'equipe'->p_mi->'etapas'->p_ei;
  if it is null then raise exception 'Etapa não encontrada'; end if;
  if coalesce((it->>'aprovado')::boolean,false) then raise exception 'Entrega já aprovada'; end if;
  it := jsonb_set(it, '{concluido}', to_jsonb(p_concluido));
  it := jsonb_set(it, '{data}', to_jsonb(case when p_concluido then to_char((now() at time zone 'America/Sao_Paulo')::date,'YYYY-MM-DD') else '' end));
  o := jsonb_set(o, array['equipe', p_mi::text, 'etapas', p_ei::text], it);
  update public.docs set data = o, updated_at = now(), updated_by = auth.uid() where path = 'obras/' || p_obra;
end $$;
revoke all on function public.marcar_entrega(text,int,int,boolean) from public, anon;
grant execute on function public.marcar_entrega(text,int,int,boolean) to authenticated;
