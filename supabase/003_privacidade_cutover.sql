-- 003 — CUTOVER: privacidade do colaborador e escrita só por lote.
-- Aplicar SOMENTE DEPOIS de publicar o novo index.html e de o administrador
-- ter aberto o sistema uma vez (isso gera as fichas em colab_fichas).
-- O app antigo deixa de funcionar para colaboradores após este script.

-- 1) colab_dados(): resposta montada campo a campo (lista explícita de permitidos),
--    a partir da ficha do próprio colaborador. Nenhum documento de obra é lido.
create or replace function public.colab_dados() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cid text; f jsonb;
begin
  select colaborador_id into cid from public.profiles where user_id = auth.uid() and role = 'colab';
  if cid is null then raise exception 'Sem acesso' using errcode = '42501'; end if;
  select data into f from public.colab_fichas where colaborador_id = cid;
  return jsonb_build_object(
    'colaborador', jsonb_build_object('id', cid, 'nome', coalesce(f#>>'{colaborador,nome}', ''), 'cargo', coalesce(f#>>'{colaborador,cargo}', '')),
    'gerado_em', f->>'gerado_em',
    'linhas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'obraId', l->>'obraId',
        'obra', l->>'obra',
        'tipo', l->>'tipo',
        'equipeIdx', coalesce((l->>'equipeIdx')::int, -1),
        'etapaIdx', coalesce((l->>'etapaIdx')::int, -1),
        'despId', l->>'despId',
        'papel', l->>'papel',
        'p', coalesce((l->>'p')::numeric, 0),
        'val', coalesce((l->>'val')::numeric, 0),
        'pago', coalesce((l->>'pago')::numeric, 0),
        'saldo', coalesce((l->>'saldo')::numeric, 0),
        'sit', l->>'sit',
        'concluido', coalesce((l->>'concluido')::boolean, false),
        'aprovado', coalesce((l->>'aprovado')::boolean, false),
        'pagarEm', coalesce(l->>'pagarEm', ''),
        'data', coalesce(l->>'data', ''),
        'mesAno', coalesce(l->>'mesAno', ''),
        'baixas', coalesce((
          select jsonb_agg(jsonb_build_object('id', b->>'id', 'data', coalesce(b->>'data', ''), 'valor', coalesce((b->>'valor')::numeric, 0)))
          from jsonb_array_elements(coalesce(l->'baixas', '[]'::jsonb)) b), '[]'::jsonb)
      ) order by ord)
      from jsonb_array_elements(coalesce(f->'linhas', '[]'::jsonb)) with ordinality t(l, ord)), '[]'::jsonb)
  );
end $$;
revoke all on function public.colab_dados() from public, anon;
grant execute on function public.colab_dados() to authenticated;

-- 2) marcar_entrega(): única escrita do colaborador. Atualiza a obra (com versão) e a ficha dele.
create or replace function public.marcar_entrega(p_obra text, p_mi int, p_ei int, p_concluido boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare cid text; o jsonb; it jsonb; f jsonb; v_data text;
begin
  select colaborador_id into cid from public.profiles where user_id = auth.uid() and role = 'colab';
  if cid is null then raise exception 'Sem acesso' using errcode = '42501'; end if;
  select data into o from public.docs where path = 'obras/' || p_obra for update;
  if o is null then raise exception 'Obra não encontrada'; end if;
  if o->'equipe'->p_mi->>'colaboradorId' is distinct from cid then raise exception 'Entrega de outra pessoa' using errcode = '42501'; end if;
  it := o->'equipe'->p_mi->'etapas'->p_ei;
  if it is null then raise exception 'Etapa não encontrada'; end if;
  if coalesce((it->>'aprovado')::boolean, false) then raise exception 'Entrega já aprovada'; end if;
  v_data := case when p_concluido then to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') else '' end;
  it := jsonb_set(jsonb_set(it, '{concluido}', to_jsonb(p_concluido)), '{data}', to_jsonb(v_data));
  o := jsonb_set(o, array['equipe', p_mi::text, 'etapas', p_ei::text], it);
  update public.docs set data = o, versao = versao + 1, updated_at = now(), updated_by = auth.uid() where path = 'obras/' || p_obra;

  select data into f from public.colab_fichas where colaborador_id = cid for update;
  if f is not null then
    f := jsonb_set(f, '{linhas}', coalesce((
      select jsonb_agg(case when l->>'obraId' = p_obra and l->>'tipo' = 'equipe_etapa'
                                 and (l->>'equipeIdx')::int = p_mi and (l->>'etapaIdx')::int = p_ei
                            then l || jsonb_build_object('concluido', p_concluido, 'data', v_data,
                                                         'sit', case when p_concluido then 'aguardando' else 'pendente' end)
                            else l end order by ord)
      from jsonb_array_elements(coalesce(f->'linhas', '[]'::jsonb)) with ordinality t(l, ord)), '[]'::jsonb));
    update public.colab_fichas set data = f, versao = versao + 1, updated_at = now() where colaborador_id = cid;
  end if;
end $$;
revoke all on function public.marcar_entrega(text, int, int, boolean) from public, anon;
grant execute on function public.marcar_entrega(text, int, int, boolean) to authenticated;

-- 3) Escrita direta nos documentos fechada: só gravar_lote() grava (transação + versão + auditoria).
drop policy if exists docs_admin_all on public.docs;
drop policy if exists docs_admin_ler on public.docs;
create policy docs_admin_ler on public.docs for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.docs from anon, authenticated;
revoke insert, update, delete, truncate on public.colab_fichas from anon, authenticated;
revoke all on public.ops, public.backups, public.convites from anon, authenticated;
