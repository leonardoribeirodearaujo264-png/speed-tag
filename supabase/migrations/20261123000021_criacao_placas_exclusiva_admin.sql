begin;

-- A criação já existe nas funções administrativas. Desabilita o caminho legado de cliente.
create or replace function public.speed_tag_criar_placa_propria(p_codigo text)
returns boolean language sql stable security invoker set search_path = ''
as $$ select false; $$;

revoke execute on function public.speed_tag_criar_placa_propria(text)
  from public, anon, authenticated, service_role;

create or replace function public.speed_tag_vincular_empresa(p_empresa uuid, p_codigo text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_admin boolean := public.eh_admin();
  v_placa public.placas%rowtype;
  v_empresa public.empresas%rowtype;
  v_do_estoque boolean;
begin
  if not public.speed_tag_acesso_cliente() then return false; end if;

  select * into v_placa from public.placas where codigo = p_codigo
    and (
      ((dono_id = v_ator or v_admin) and status in ('atribuida', 'ativa'))
      or (v_admin and dono_id is null and status = 'disponivel')
    ) for update;
  if not found then return false; end if;
  v_do_estoque := v_placa.status = 'disponivel';

  select * into v_empresa from public.empresas where id = p_empresa
    and (dono_id = v_ator or v_admin)
    and (dono_id is not distinct from v_placa.dono_id or (v_admin and v_do_estoque and dono_id is not null))
    for share;

  if not found or public.link_avaliacao_valido(v_empresa.link_avaliacao) is not true then return false; end if;
  if not v_do_estoque and v_placa.empresa_id = v_empresa.id and v_placa.destino_url = v_empresa.link_avaliacao then
    return true;
  end if;

  if v_do_estoque then
    if v_empresa.dono_id is null or not public.speed_tag_conta_liberada(v_empresa.dono_id) then return false; end if;
    if (public.admin_atribuir_placas(array[v_placa.codigo], v_empresa.dono_id)->>'ok') is distinct from 'true' then
      return false;
    end if;
  end if;

  update public.placas set empresa_id = v_empresa.id, destino_url = v_empresa.link_avaliacao,
    status = 'ativa', ativada_em = coalesce(ativada_em, now()) where id = v_placa.id;
  insert into public.historico_placa (placa_id, acao, ator_id, antes, depois)
    values (v_placa.id, case when v_placa.status = 'ativa' then 'trocou_destino' else 'ativou' end, v_ator,
      jsonb_build_object('empresa_id', v_placa.empresa_id, 'destino_url', v_placa.destino_url),
      jsonb_build_object('empresa_id', v_empresa.id, 'destino_url', v_empresa.link_avaliacao));
  return true;
end;
$$;

revoke execute on function public.speed_tag_vincular_empresa(uuid,text) from public, anon, authenticated;
grant execute on function public.speed_tag_vincular_empresa(uuid,text) to authenticated;

commit;
