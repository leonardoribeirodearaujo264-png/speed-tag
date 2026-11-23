-- Gestão de placas pelo admin: transferir para outro cliente e mover de lote, uma ou várias
-- de uma vez. Não apaga nem altera registros existentes além das placas escolhidas.
-- Rodar uma vez no SQL Editor.

do $$
declare
  v_conflitos text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_conflitos
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('admin_transferir_placas', 'admin_mover_lote');
  if v_conflitos is not null then
    raise exception 'Já existem funções com estes nomes no schema public: %. Nada foi alterado.', v_conflitos;
  end if;
end;
$$;

alter table public.historico_placa drop constraint historico_placa_acao_check;
alter table public.historico_placa add constraint historico_placa_acao_check check (acao in (
  'criou', 'gravou_nfc', 'travou_nfc', 'ativou', 'trocou_destino',
  'bloqueou', 'desbloqueou', 'resetou', 'reivindicou',
  'reservou', 'atribuiu', 'liberou', 'desativou', 'reativou', 'tentativa_negada',
  'transferiu', 'mudou_lote'
));

-- Transfere placas (atribuídas ou ativas) para outro cliente. Placa ativa continua
-- funcionando: a empresa é copiada para a conta nova (a antiga não é alterada).
create function public.admin_transferir_placas(p_codigos text[], p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_placa public.placas%rowtype;
  v_empresa public.empresas%rowtype;
  v_nova_empresa uuid;
  v_total integer := 0;
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfis where id = p_usuario) then
    return jsonb_build_object('ok', false, 'erro', 'USUARIO_NAO_ENCONTRADO');
  end if;
  if coalesce(array_length(p_codigos, 1), 0) not between 1 and 500 then
    return jsonb_build_object('ok', false, 'erro', 'QUANTIDADE_INVALIDA');
  end if;

  for v_placa in
    select * from public.placas
    where codigo = any (select public.normalizar_codigo(c) from unnest(p_codigos) c)
    for update
  loop
    if v_placa.status::text not in ('atribuida', 'ativa') or v_placa.dono_id = p_usuario then
      continue;
    end if;

    v_nova_empresa := v_placa.empresa_id;
    if v_placa.empresa_id is not null then
      select * into v_empresa from public.empresas where id = v_placa.empresa_id;
      v_nova_empresa := public.obter_ou_criar_empresa(
        p_usuario, v_empresa.origem, v_empresa.google_place_id, v_empresa.nome, v_empresa.link_avaliacao
      );
    end if;

    update public.placas set dono_id = p_usuario, empresa_id = v_nova_empresa where id = v_placa.id;
    insert into public.historico_placa (placa_id, acao, antes, depois, ator_id)
    values (v_placa.id, 'transferiu', jsonb_build_object('dono_id', v_placa.dono_id),
            jsonb_build_object('dono_id', p_usuario), v_ator);
    v_total := v_total + 1;
  end loop;

  return jsonb_build_object('ok', true, 'quantidade', v_total);
end;
$$;

-- Move placas para um lote (ou tira do lote, com p_lote nulo).
create function public.admin_mover_lote(p_codigos text[], p_lote uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_total integer;
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  if p_lote is not null and not exists (select 1 from public.lotes where id = p_lote) then
    return jsonb_build_object('ok', false, 'erro', 'LOTE_NAO_ENCONTRADO');
  end if;
  if coalesce(array_length(p_codigos, 1), 0) not between 1 and 500 then
    return jsonb_build_object('ok', false, 'erro', 'QUANTIDADE_INVALIDA');
  end if;

  with alvo as (
    update public.placas p set lote_id = p_lote
    where p.codigo = any (select public.normalizar_codigo(c) from unnest(p_codigos) c)
      and p.lote_id is distinct from p_lote
    returning p.id, p.lote_id
  ), registro as (
    insert into public.historico_placa (placa_id, acao, depois, ator_id)
    select id, 'mudou_lote', jsonb_build_object('lote_id', p_lote), v_ator from alvo
    returning 1
  )
  select count(*) into v_total from registro;

  return jsonb_build_object('ok', true, 'quantidade', v_total);
end;
$$;

revoke execute on function public.admin_transferir_placas(text[], uuid), public.admin_mover_lote(text[], uuid)
  from public, anon, authenticated;
grant execute on function public.admin_transferir_placas(text[], uuid), public.admin_mover_lote(text[], uuid)
  to authenticated;
