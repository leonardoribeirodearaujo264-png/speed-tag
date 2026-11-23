begin;

-- Preserva os administradores ativos já aprovados antes da migração.
lock table public.perfis in share row exclusive mode;
create table public.speed_tag_administradores (
  usuario_id uuid primary key references public.perfis(id) on delete restrict
);
alter table public.speed_tag_administradores enable row level security;
revoke all on public.speed_tag_administradores from public, anon, authenticated;

insert into public.speed_tag_administradores (usuario_id)
select id from public.perfis where papel = 'admin' and bloqueado_em is null;

do $$
begin
  if not exists (select 1 from public.speed_tag_administradores)
    and exists (select 1 from public.perfis where papel = 'admin') then
    raise exception 'É necessário ter pelo menos um administrador ativo antes da migração';
  end if;
end;
$$;

update public.perfis p set papel = 'cliente'
where p.papel = 'admin' and not exists (
  select 1 from public.speed_tag_administradores a where a.usuario_id = p.id
);

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.speed_tag_administradores a join public.perfis p on p.id = a.usuario_id
    where a.usuario_id = (select auth.uid()) and p.papel = 'admin' and p.bloqueado_em is null
  );
$$;

revoke execute on function public.solicitar_admin(), public.recusar_solicitacao_admin(uuid) from authenticated;

alter table public.perfis add column limite_placas integer check (limite_placas between 0 and 10000);
alter table public.placas_segredos_nfc add constraint placas_segredo_nfc_unico unique (hash);

create function public.speed_tag_conta_liberada(p_usuario uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfis where id = p_usuario and bloqueado_em is null);
$$;

create function public.speed_tag_acesso_cliente()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.speed_tag_conta_liberada((select auth.uid())); $$;

revoke execute on function public.speed_tag_conta_liberada(uuid), public.speed_tag_acesso_cliente()
  from public, anon, authenticated;
grant execute on function public.speed_tag_acesso_cliente() to authenticated;

create policy placas_conta_liberada on public.placas as restrictive for all to authenticated
  using ((select public.speed_tag_acesso_cliente())) with check ((select public.speed_tag_acesso_cliente()));
create policy empresas_conta_liberada on public.empresas as restrictive for all to authenticated
  using ((select public.speed_tag_acesso_cliente())) with check ((select public.speed_tag_acesso_cliente()));
create policy historico_privacidade_transferencia on public.historico_placa as restrictive for select to authenticated
  using ((select public.eh_admin()) or ator_id = (select auth.uid()));
create policy leituras_privacidade_transferencia on public.leituras as restrictive for select to authenticated
  using ((select public.eh_admin()) or exists (
    select 1 from public.placas p where p.id = placa_id and p.dono_id = (select auth.uid())
      and (p.atribuida_em is null or ocorrida_em >= p.atribuida_em)
  ));

create function public.speed_tag_proteger_perfil()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.speed_tag_administradores where usuario_id = new.id)
    and (new.papel <> 'admin' or new.bloqueado_em is not null) then
    raise insufficient_privilege;
  end if;
  if new.papel = 'admin' and not exists (
    select 1 from public.speed_tag_administradores where usuario_id = new.id
  ) then
    if tg_op = 'INSERT' then raise insufficient_privilege; end if;
    if old.papel is distinct from new.papel then raise insufficient_privilege; end if;
  end if;
  return new;
end;
$$;

create trigger speed_tag_proteger_perfil before insert or update of papel, bloqueado_em on public.perfis
  for each row execute function public.speed_tag_proteger_perfil();

alter function public.trocar_destino(uuid, public.origem_empresa, text, text, text)
  rename to speed_tag_trocar_destino_interno;
revoke execute on function public.speed_tag_trocar_destino_interno(uuid, public.origem_empresa, text, text, text)
  from public, anon, authenticated;
create function public.trocar_destino(
  p_placa_id uuid, p_origem public.origem_empresa, p_place_id text, p_nome text, p_link text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not public.speed_tag_acesso_cliente() then
    return jsonb_build_object('ok', false, 'erro', 'NAO_AUTENTICADO');
  end if;
  return public.speed_tag_trocar_destino_interno(p_placa_id, p_origem, p_place_id, p_nome, p_link);
end;
$$;
revoke execute on function public.trocar_destino(uuid, public.origem_empresa, text, text, text)
  from public, anon, authenticated;
grant execute on function public.trocar_destino(uuid, public.origem_empresa, text, text, text) to authenticated;

create function public.speed_tag_limitar_placas()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_limite integer;
  v_bloqueado timestamptz;
begin
  if new.dono_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.dono_id is not distinct from new.dono_id then
    if (old.destino_url is distinct from new.destino_url or old.empresa_id is distinct from new.empresa_id)
      and new.status = 'ativa' and not public.eh_admin()
      and not public.speed_tag_conta_liberada(new.dono_id) then
      raise exception 'CONTA_BLOQUEADA' using errcode = '42501';
    end if;
    return new;
  end if;

  select limite_placas, bloqueado_em into v_limite, v_bloqueado from public.perfis
    where id = new.dono_id for no key update;
  if v_bloqueado is not null then raise exception 'CONTA_BLOQUEADA' using errcode = '42501'; end if;
  if v_limite is not null and (
    select count(*) from public.placas where dono_id = new.dono_id
  ) >= v_limite then
    raise exception 'LIMITE_PLACAS' using errcode = '23514';
  end if;
  new.atribuida_em := coalesce(new.atribuida_em, now());
  if tg_op = 'UPDATE' then
    new.atribuida_em := now();
    delete from public.placas_segredos_nfc where placa_id = new.id;
  end if;
  return new;
end;
$$;

create trigger speed_tag_limitar_placas before insert or update of dono_id, destino_url, empresa_id on public.placas
  for each row execute function public.speed_tag_limitar_placas();

create function public.speed_tag_editar_cliente(
  p_usuario uuid, p_nome text, p_telefone text,
  p_bloqueado boolean, p_limite integer
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_resultado jsonb;
  v_papel public.papel_usuario;
begin
  if not public.eh_admin() then raise insufficient_privilege; end if;
  select papel into v_papel from public.perfis where id = p_usuario for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;
  v_resultado := public.admin_atualizar_usuario(p_usuario, p_nome, p_telefone, v_papel, p_bloqueado);
  if v_resultado->>'ok' = 'true' then
    update public.perfis set limite_placas = p_limite where id = p_usuario;
  end if;
  return v_resultado;
end;
$$;

create function public.speed_tag_criar_placa_propria(p_codigo text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_id uuid;
begin
  perform 1 from public.perfis where id = v_ator and bloqueado_em is null and limite_placas > 0 for no key update;
  if not found then return false; end if;
  insert into public.placas (codigo, dono_id, status, atribuida_em, criada_por)
    values (p_codigo, v_ator, 'atribuida', now(), v_ator) returning id into v_id;
  insert into public.historico_placa (placa_id, acao, ator_id, depois)
    values (v_id, 'criou', v_ator, jsonb_build_object('origem', 'placa_propria'));
  return true;
end;
$$;

-- Reclamação única. A placa fica atribuída para o cliente completar a ativação.
create function public.speed_tag_reivindicar_nfc(p_codigo text, p_hash text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_placa uuid;
begin
  if not public.speed_tag_conta_liberada(v_ator) then return false; end if;
  v_placa := public.placas_autorizar_nfc(p_codigo, v_ator, p_hash);
  if v_placa is null then return false; end if;

  update public.placas set dono_id = v_ator, status = 'atribuida', atribuida_em = now()
  where id = v_placa and dono_id is null;
  if found then
    delete from public.placas_segredos_nfc where placa_id = v_placa;
    insert into public.historico_placa (placa_id, acao, ator_id, depois)
    values (v_placa, 'reivindicou', v_ator, jsonb_build_object('origem', 'codigo_nfc'));
  end if;
  return true;
end;
$$;

create function public.speed_tag_admin_transferir(p_codigo text, p_usuario uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_placa public.placas%rowtype;
  v_resultado jsonb;
begin
  if not public.eh_admin() then raise insufficient_privilege; end if;
  if not public.speed_tag_conta_liberada(p_usuario) then return false; end if;
  select * into v_placa from public.placas where codigo = p_codigo for update;
  if not found or v_placa.status = 'desativada' or v_placa.dono_id is not distinct from p_usuario then return false; end if;
  if v_placa.status in ('atribuida', 'ativa') then
    v_resultado := public.admin_transferir_placas(array[p_codigo], p_usuario);
    if v_resultado->>'ok' is distinct from 'true' or v_resultado->>'quantidade' is distinct from '1' then
      return false;
    end if;
  else
    v_resultado := public.admin_atribuir_placas(array[p_codigo], p_usuario);
    if v_resultado->>'ok' is distinct from 'true' then return false; end if;
  end if;
  update public.placas set atribuida_em = now(), email_ativacao = null where id = v_placa.id;
  delete from public.placas_segredos_nfc where placa_id = v_placa.id;
  return true;
end;
$$;

revoke execute on function public.speed_tag_proteger_perfil(), public.speed_tag_limitar_placas(),
  public.speed_tag_editar_cliente(uuid,text,text,boolean,integer),
  public.speed_tag_criar_placa_propria(text), public.speed_tag_reivindicar_nfc(text,text),
  public.speed_tag_admin_transferir(text,uuid) from public, anon, authenticated;
grant execute on function public.speed_tag_editar_cliente(uuid,text,text,boolean,integer),
  public.speed_tag_criar_placa_propria(text), public.speed_tag_reivindicar_nfc(text,text),
  public.speed_tag_admin_transferir(text,uuid) to authenticated;

alter table public.historico_placa drop constraint historico_placa_acao_check;
alter table public.historico_placa add constraint historico_placa_acao_check check (acao in (
  'criou', 'gravou_nfc', 'travou_nfc', 'ativou', 'trocou_destino',
  'bloqueou', 'desbloqueou', 'resetou', 'reivindicou',
  'reservou', 'atribuiu', 'liberou', 'desativou', 'reativou', 'tentativa_negada',
  'transferiu', 'mudou_lote', 'editou_empresa'
));

create function public.speed_tag_renomear_empresa(p_empresa uuid, p_nome text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_nome text := btrim(coalesce(p_nome, ''));
  v_antes text;
begin
  if not public.speed_tag_acesso_cliente() or char_length(v_nome) not between 1 and 200 then
    return false;
  end if;
  select nome into v_antes from public.empresas
  where id = p_empresa and (dono_id = v_ator or public.eh_admin()) for update;
  if not found then return false; end if;
  if v_nome = v_antes then return true; end if;
  update public.empresas set nome = v_nome where id = p_empresa;
  insert into public.historico_placa (placa_id, acao, ator_id, antes, depois)
    select id, 'editou_empresa', v_ator, jsonb_build_object('nome', v_antes), jsonb_build_object('nome', v_nome)
    from public.placas where empresa_id = p_empresa and (dono_id = v_ator or public.eh_admin());
  return true;
end;
$$;
revoke execute on function public.speed_tag_renomear_empresa(uuid,text) from public, anon, authenticated;
grant execute on function public.speed_tag_renomear_empresa(uuid,text) to authenticated;
commit;
