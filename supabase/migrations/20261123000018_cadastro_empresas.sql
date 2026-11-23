begin;

alter table public.empresas add column email_contato text
  check (char_length(email_contato) <= 254 and email_contato ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$');

create unique index empresas_cadastro_dono_nome_idx
  on public.empresas (dono_id, lower(btrim(nome))) where email_contato is not null and dono_id is not null;

create function public.speed_tag_cadastrar_empresa(p_dono uuid, p_nome text, p_email text, p_link text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_id uuid;
begin
  if not public.speed_tag_acesso_cliente() or (p_dono is distinct from v_ator and not public.eh_admin()) then
    raise insufficient_privilege;
  end if;
  if p_dono is null or not public.speed_tag_conta_liberada(p_dono) or p_email is null or p_nome is null then
    raise exception 'CADASTRO_EMPRESA_INVALIDO' using errcode = '22023';
  end if;
  if coalesce(p_link, '') <> '' and not public.link_avaliacao_valido(p_link) then
    raise exception 'LINK_AVALIACAO_INVALIDO' using errcode = '22023';
  end if;
  insert into public.empresas (dono_id, origem, nome, email_contato, link_avaliacao)
    values (p_dono, 'manual', btrim(p_nome), lower(btrim(p_email)), coalesce(p_link, ''))
    returning id into v_id;
  return v_id;
end;
$$;

create function public.speed_tag_editar_empresa(p_empresa uuid, p_nome text, p_email text, p_link text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_link is not null and not public.link_avaliacao_valido(p_link) then return false; end if;
  if not public.speed_tag_renomear_empresa(p_empresa, p_nome) then return false; end if;
  update public.empresas set email_contato = lower(btrim(p_email)),
    link_avaliacao = coalesce(nullif(link_avaliacao, ''), p_link, '') where id = p_empresa;
  return found;
end;
$$;

create function public.speed_tag_vincular_empresa(p_empresa uuid, p_codigo text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_placa public.placas%rowtype;
  v_empresa public.empresas%rowtype;
begin
  if not public.speed_tag_acesso_cliente() then return false; end if;
  select * into v_placa from public.placas where codigo = p_codigo
    and dono_id = v_ator and status in ('atribuida', 'ativa') for update;
  if not found then return false; end if;
  select * into v_empresa from public.empresas where id = p_empresa and dono_id = v_ator for share;
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

revoke execute on function public.speed_tag_cadastrar_empresa(uuid,text,text,text),
  public.speed_tag_editar_empresa(uuid,text,text,text), public.speed_tag_vincular_empresa(uuid,text) from public, anon, authenticated;
grant execute on function public.speed_tag_cadastrar_empresa(uuid,text,text,text),
  public.speed_tag_editar_empresa(uuid,text,text,text), public.speed_tag_vincular_empresa(uuid,text) to authenticated;

commit;
