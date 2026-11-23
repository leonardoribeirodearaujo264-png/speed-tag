begin;

-- Edita a empresa e atualiza os destinos das placas na mesma transação.
create function public.speed_tag_editar_empresa_completa(p_empresa uuid, p_nome text, p_email text, p_link text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_admin boolean := public.eh_admin();
  v_anterior public.empresas%rowtype;
  v_link text := nullif(btrim(p_link), '');
  v_nome text := btrim(p_nome);
begin
  if not public.speed_tag_acesso_cliente() or coalesce(char_length(v_nome), 0) not between 1 and 200 then
    return false;
  end if;
  if v_link is not null and public.link_avaliacao_valido(v_link) is not true then return false; end if;

  -- Mesmo sentido de bloqueio da vinculação existente: placa antes de empresa.
  perform p.id from public.placas p join public.empresas e on e.id = p.empresa_id
    where e.id = p_empresa and (e.dono_id = v_ator or v_admin)
      and p.dono_id is not distinct from e.dono_id
    order by p.id for update of p;
  select * into v_anterior from public.empresas
    where id = p_empresa and (dono_id = v_ator or v_admin) for update;
  if not found then return false; end if;

  update public.empresas set nome = v_nome, email_contato = lower(btrim(p_email)), link_avaliacao = coalesce(v_link, '')
    where id = p_empresa;

  if v_anterior.link_avaliacao is distinct from coalesce(v_link, '') then
    update public.placas set
      destino_url = v_link,
      status = case when v_link is null then 'atribuida'::public.status_placa else 'ativa'::public.status_placa end,
      ativada_em = case when v_link is not null then coalesce(ativada_em, now()) else ativada_em end
    where empresa_id = p_empresa and dono_id is not distinct from v_anterior.dono_id
      and (status = 'ativa' or (status = 'atribuida' and ativada_em is not null and v_link is not null));
  end if;

  if v_anterior.nome is distinct from v_nome or v_anterior.link_avaliacao is distinct from coalesce(v_link, '') then
    insert into public.historico_placa (placa_id, acao, ator_id, antes, depois)
      select id, 'editou_empresa', v_ator,
        jsonb_build_object('nome', v_anterior.nome, 'link_avaliacao', v_anterior.link_avaliacao),
        jsonb_build_object('nome', v_nome, 'link_avaliacao', v_link)
      from public.placas where empresa_id = p_empresa and dono_id is not distinct from v_anterior.dono_id;
  end if;
  return true;
end;
$$;

create function public.speed_tag_remover_placa_da_empresa(p_empresa uuid, p_codigo text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_placa public.placas%rowtype;
begin
  if not public.speed_tag_acesso_cliente() then return false; end if;
  select p.* into v_placa from public.placas p join public.empresas e on e.id = p.empresa_id
    where p.codigo = p_codigo and e.id = p_empresa and e.dono_id = v_ator and p.dono_id = v_ator
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

revoke execute on function public.speed_tag_editar_empresa_completa(uuid,text,text,text),
  public.speed_tag_remover_placa_da_empresa(uuid,text) from public, anon, authenticated;
grant execute on function public.speed_tag_editar_empresa_completa(uuid,text,text,text),
  public.speed_tag_remover_placa_da_empresa(uuid,text) to authenticated;
commit;
