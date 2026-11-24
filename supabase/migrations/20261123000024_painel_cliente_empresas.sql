begin;

create function public.speed_tag_acessos_empresas(p_empresas uuid[])
returns table (empresa_id uuid, acessos bigint)
language sql stable security invoker set search_path = ''
as $$
  select e.id, count(l.id)
  from public.empresas e
  left join public.placas p on p.empresa_id = e.id and p.dono_id = e.dono_id
  left join public.leituras l on l.placa_id = p.id and l.ocorrida_em >= coalesce(p.ativada_em, p.atribuida_em, p.criado_em)
  where e.id = any(p_empresas) and e.dono_id = (select auth.uid())
    and public.speed_tag_acesso_cliente()
  group by e.id;
$$;

create function public.speed_tag_gerenciar_empresa_cliente(p_empresa uuid, p_link text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_link text := btrim(p_link);
begin
  if v_ator is null or not public.speed_tag_acesso_cliente() then return false; end if;
  if p_link is not null and public.link_avaliacao_valido(v_link) is not true then return false; end if;

  -- A ativação também bloqueia a placa antes da empresa.
  perform p.id from public.placas p join public.empresas e on e.id = p.empresa_id
    where e.id = p_empresa and e.dono_id = v_ator order by p.id for update of p;
  perform 1 from public.empresas where id = p_empresa and dono_id = v_ator for update;
  if not found then return false; end if;
  if exists (select 1 from public.placas where empresa_id = p_empresa and dono_id is distinct from v_ator) then
    return false;
  end if;

  if p_link is null then
    insert into public.historico_placa (placa_id, acao, ator_id, antes, depois)
      select id, 'trocou_destino', v_ator, jsonb_build_object('empresa_id', p_empresa, 'destino_url', destino_url),
        jsonb_build_object('empresa_id', null, 'destino_url', null)
      from public.placas where empresa_id = p_empresa;
    update public.placas set empresa_id = null, destino_url = null, ativada_em = null,
      status = case when status = 'ativa' then 'atribuida'::public.status_placa else status end
      where empresa_id = p_empresa and dono_id = v_ator;
    delete from public.empresas where id = p_empresa and dono_id = v_ator;
  else
    update public.empresas set link_avaliacao = v_link where id = p_empresa and dono_id = v_ator;
    insert into public.historico_placa (placa_id, acao, ator_id, antes, depois)
      select id, 'trocou_destino', v_ator, jsonb_build_object('destino_url', destino_url),
        jsonb_build_object('destino_url', v_link)
      from public.placas where empresa_id = p_empresa and dono_id = v_ator
        and status = 'ativa' and destino_url is distinct from v_link;
    update public.placas set destino_url = v_link
      where empresa_id = p_empresa and dono_id = v_ator and status = 'ativa'
        and destino_url is distinct from v_link;
  end if;
  return true;
end;
$$;

revoke all on function public.speed_tag_acessos_empresas(uuid[]),
  public.speed_tag_gerenciar_empresa_cliente(uuid,text) from public, anon, authenticated;
grant execute on function public.speed_tag_acessos_empresas(uuid[]),
  public.speed_tag_gerenciar_empresa_cliente(uuid,text) to authenticated;

create or replace function public.trocar_destino(
  p_placa_id uuid, p_origem public.origem_empresa, p_place_id text, p_nome text, p_link text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not public.eh_admin() then return jsonb_build_object('ok', false, 'erro', 'SEM_ACESSO'); end if;
  return public.speed_tag_trocar_destino_interno(p_placa_id, p_origem, p_place_id, p_nome, p_link);
end;
$$;

alter function public.speed_tag_remover_placa_da_empresa(uuid,text) rename to speed_tag_remover_placa_interno;
revoke execute on function public.speed_tag_remover_placa_interno(uuid,text) from public, anon, authenticated;
create function public.speed_tag_remover_placa_da_empresa(p_empresa uuid, p_codigo text)
returns boolean language sql security definer set search_path = ''
as $$
  select case when public.eh_admin() then public.speed_tag_remover_placa_interno(p_empresa, p_codigo) else false end;
$$;
revoke all on function public.speed_tag_remover_placa_da_empresa(uuid,text) from public, anon, authenticated;
grant execute on function public.speed_tag_remover_placa_da_empresa(uuid,text) to authenticated;

alter function public.speed_tag_vincular_empresa(uuid,text) rename to speed_tag_vincular_empresa_interno;
revoke execute on function public.speed_tag_vincular_empresa_interno(uuid,text) from public, anon, authenticated;
create function public.speed_tag_vincular_empresa(p_empresa uuid, p_codigo text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.eh_admin() then
    perform 1 from public.placas where codigo = p_codigo and dono_id = (select auth.uid())
      and status = 'atribuida' and destino_url is null for update;
    if not found then return false; end if;
  end if;
  return public.speed_tag_vincular_empresa_interno(p_empresa, p_codigo);
end;
$$;
revoke all on function public.speed_tag_vincular_empresa(uuid,text) from public, anon, authenticated;
grant execute on function public.speed_tag_vincular_empresa(uuid,text) to authenticated;

commit;
