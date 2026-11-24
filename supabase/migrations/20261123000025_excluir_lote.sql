-- Exclusão de lote pelo ADM.
-- Regra: só apaga quando nenhuma placa do lote está ativa, aguardando ativação ou com dono.
-- As placas do lote (em estoque, reservadas ou desativadas sem dono) são apagadas junto;
-- leituras e histórico delas vão por on delete cascade, como em "Apagar placa".
-- Como o histórico das placas apagadas some com elas, o registro do que foi apagado
-- fica em lotes_excluidos (somente ADM lê; ninguém escreve direto).

begin;

create table public.lotes_excluidos (
  id bigint generated always as identity primary key,
  lote_id uuid not null,
  nome text not null,
  revendedor text,
  lote_criado_em timestamptz not null,
  placas_apagadas integer not null,
  codigos text[] not null default '{}',
  ator_id uuid references public.perfis (id) on delete set null,
  excluido_em timestamptz not null default now()
);

alter table public.lotes_excluidos enable row level security;
revoke all on public.lotes_excluidos from anon, authenticated;
grant select on public.lotes_excluidos to authenticated;
create policy lotes_excluidos_admin_leitura on public.lotes_excluidos
  for select to authenticated using (public.eh_admin());

create function public.speed_tag_excluir_lote(p_lote uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_lote public.lotes%rowtype;
  v_total integer;
  v_em_uso integer;
  v_codigos text[];
begin
  if v_ator is null or not public.eh_admin() then
    return jsonb_build_object('ok', false, 'erro', 'SEM_ACESSO');
  end if;

  select * into v_lote from public.lotes where id = p_lote for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'LOTE_NAO_ENCONTRADO'); end if;

  -- Trava as placas do lote para ninguém ativar ou atribuir no meio da exclusão.
  perform 1 from public.placas where lote_id = p_lote order by id for update;

  select count(*)::integer,
         (count(*) filter (where status::text in ('ativa', 'atribuida') or dono_id is not null))::integer,
         coalesce(array_agg(codigo order by codigo), '{}')
    into v_total, v_em_uso, v_codigos
    from public.placas where lote_id = p_lote;

  if v_em_uso > 0 then
    return jsonb_build_object('ok', false, 'erro', 'PLACAS_EM_USO', 'total', v_total, 'em_uso', v_em_uso);
  end if;

  insert into public.lotes_excluidos (lote_id, nome, revendedor, lote_criado_em, placas_apagadas, codigos, ator_id)
    values (v_lote.id, v_lote.nome, v_lote.revendedor, v_lote.criado_em, v_total, v_codigos, v_ator);

  delete from public.placas where lote_id = p_lote;
  delete from public.lotes where id = p_lote;

  return jsonb_build_object('ok', true, 'placas_apagadas', v_total, 'nome', v_lote.nome);
end;
$$;

revoke all on function public.speed_tag_excluir_lote(uuid) from public, anon, authenticated;
grant execute on function public.speed_tag_excluir_lote(uuid) to authenticated;

commit;
