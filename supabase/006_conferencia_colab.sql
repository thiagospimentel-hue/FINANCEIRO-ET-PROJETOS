-- Colaborador passa a receber também a conferência mensal (devido x recebido) da própria ficha.
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
      from jsonb_array_elements(coalesce(f->'linhas', '[]'::jsonb)) with ordinality t(l, ord)), '[]'::jsonb),
    'conferencia', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ym', c->>'ym',
        'dev', coalesce((c->>'dev')::numeric, 0),
        'pago', coalesce((c->>'pago')::numeric, 0),
        'dif', coalesce((c->>'dif')::numeric, 0),
        'acum', coalesce((c->>'acum')::numeric, 0),
        'pagoEm', coalesce(c->>'pagoEm', '')
      ) order by ord)
      from jsonb_array_elements(coalesce(f->'conferencia', '[]'::jsonb)) with ordinality t2(c, ord)), '[]'::jsonb)
  );
end $$;
