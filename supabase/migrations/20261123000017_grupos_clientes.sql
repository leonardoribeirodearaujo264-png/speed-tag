begin;

alter table public.perfis add column grupo_cliente text
  check (grupo_cliente is null or (grupo_cliente in ('revendedor', 'comprador') and papel = 'cliente'));
create index perfis_grupo_cliente_idx on public.perfis (grupo_cliente, criado_em desc)
  where papel = 'cliente';

create function public.speed_tag_editar_cliente_grupo(
  p_usuario uuid, p_nome text, p_telefone text, p_bloqueado boolean, p_limite integer, p_grupo text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  v_resultado := public.speed_tag_editar_cliente(p_usuario, p_nome, p_telefone, p_bloqueado, p_limite);
  if v_resultado->>'ok' = 'true' then
    update public.perfis set grupo_cliente = p_grupo where id = p_usuario and papel = 'cliente';
  end if;
  return v_resultado;
end;
$$;

create function public.speed_tag_contar_placas_clientes(p_usuarios uuid[])
returns table (usuario_id uuid, total bigint)
language sql stable security invoker set search_path = ''
as $$
  select dono_id, count(*) from public.placas
  where public.eh_admin() and dono_id = any(p_usuarios)
  group by dono_id;
$$;

create function public.speed_tag_remover_acesso_cliente(p_usuario uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.eh_admin() then raise insufficient_privilege; end if;
  update public.perfis set bloqueado_em = coalesce(bloqueado_em, now())
  where id = p_usuario and papel = 'cliente';
  return found;
end;
$$;

-- Quem resgata um código de compra entra no grupo de compradores se ainda não tiver classificação.
create function public.speed_tag_classificar_compra_nfc()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.acao = 'reivindicou' and new.depois->>'origem' = 'codigo_nfc' then
    update public.perfis set grupo_cliente = 'comprador'
    where id = new.ator_id and papel = 'cliente' and grupo_cliente is null;
  end if;
  return new;
end;
$$;
create trigger speed_tag_classificar_compra_nfc after insert on public.historico_placa
  for each row execute function public.speed_tag_classificar_compra_nfc();

revoke execute on function public.speed_tag_editar_cliente_grupo(uuid,text,text,boolean,integer,text),
  public.speed_tag_contar_placas_clientes(uuid[]), public.speed_tag_remover_acesso_cliente(uuid),
  public.speed_tag_classificar_compra_nfc() from public, anon, authenticated;
grant execute on function public.speed_tag_editar_cliente_grupo(uuid,text,text,boolean,integer,text),
  public.speed_tag_contar_placas_clientes(uuid[]), public.speed_tag_remover_acesso_cliente(uuid) to authenticated;

commit;
