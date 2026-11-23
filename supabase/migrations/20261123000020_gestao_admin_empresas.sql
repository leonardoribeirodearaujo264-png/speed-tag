begin;

create or replace function public.speed_tag_vincular_empresa(p_empresa uuid, p_codigo text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_admin boolean := public.eh_admin();
  v_placa public.placas%rowtype;
  v_empresa public.empresas%rowtype;
begin
  if not public.speed_tag_acesso_cliente() then return false; end if;
  select * into v_placa from public.placas where codigo = p_codigo
    and (dono_id = v_ator or v_admin) and status in ('atribuida', 'ativa') for update;
  if not found then return false; end if;
  select * into v_empresa from public.empresas where id = p_empresa and (dono_id = v_ator or v_admin)
    and dono_id is not distinct from v_placa.dono_id for share;
  if not found or not public.link_avaliacao_valido(v_empresa.link_avaliacao) then return false; end if;
  if v_placa.empresa_id = v_empresa.id and v_placa.destino_url = v_empresa.link_avaliacao then return true; end if;
  update public.placas set empresa_id = v_empresa.id, destino_url = v_empresa.link_avaliacao,
    status = 'ativa', ativada_em = coalesce(ativada_em, now())
  where id = v_placa.id;
  insert into public.historico_placa (placa_id, acao, ator_id, antes, depois)
    values (v_placa.id, case when v_placa.status = 'atribuida' then 'ativou' else 'trocou_destino' end, v_ator,
      jsonb_build_object('empresa_id', v_placa.empresa_id, 'destino_url', v_placa.destino_url),
      jsonb_build_object('empresa_id', v_empresa.id, 'destino_url', v_empresa.link_avaliacao));
  return true;
end;
$$;

create or replace function public.speed_tag_remover_placa_da_empresa(p_empresa uuid, p_codigo text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_admin boolean := public.eh_admin();
  v_placa public.placas%rowtype;
begin
  if not public.speed_tag_acesso_cliente() then return false; end if;
  select p.* into v_placa from public.placas p join public.empresas e on e.id = p.empresa_id
    where p.codigo = p_codigo and e.id = p_empresa and (e.dono_id = v_ator or v_admin)
      and p.dono_id is not distinct from e.dono_id
    for update of p;
  if not found then return false; end if;

  update public.placas set empresa_id = null, destino_url = null, ativada_em = null,
    status = case when v_placa.status = 'ativa' then 'atribuida'::public.status_placa else v_placa.status end
    where id = v_placa.id;
  insert into public.historico_placa (placa_id, acao, ator_id, antes, depois)
    values (v_placa.id, 'trocou_destino', v_ator,
      jsonb_build_object('empresa_id', p_empresa, 'destino_url', v_placa.destino_url),
      jsonb_build_object('empresa_id', null, 'destino_url', null));
  return true;
end;
$$;

commit;
