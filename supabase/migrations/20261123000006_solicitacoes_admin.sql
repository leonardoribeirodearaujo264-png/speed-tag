-- Registro de administradores com aprovação.
-- Quem se registra em /admin/registrar vira um pedido de acesso; um admin
-- aprova ou recusa em /admin/administradores. Rodar uma vez no SQL Editor.

do $$
declare
  v_conflitos text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_conflitos
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('solicitar_admin', 'recusar_solicitacao_admin');
  if v_conflitos is not null then
    raise exception 'Já existem funções com estes nomes no schema public: %. Nada foi alterado.', v_conflitos;
  end if;
end;
$$;

alter table public.perfis add column solicitou_admin_em timestamptz;
alter table public.perfis add column admin_recusado_em timestamptz;

create index perfis_solicitacoes_idx on public.perfis (solicitou_admin_em)
  where solicitou_admin_em is not null and papel = 'cliente';

-- O usuário logado pede acesso. Idempotente; não reabre pedido recusado.
create function public.solicitar_admin()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_perfil public.perfis%rowtype;
begin
  if v_usuario is null then
    raise exception 'login necessário' using errcode = '42501';
  end if;

  insert into public.perfis (id, email, nome)
  select u.id, lower(u.email), left(u.raw_user_meta_data ->> 'name', 120)
  from auth.users u where u.id = v_usuario
  on conflict (id) do nothing;

  select * into v_perfil from public.perfis where id = v_usuario;

  if v_perfil.papel = 'admin' then return 'ADMIN'; end if;
  if v_perfil.admin_recusado_em is not null then return 'RECUSADO'; end if;

  update public.perfis
  set solicitou_admin_em = coalesce(solicitou_admin_em, now()),
      nome = coalesce(nome, (select left(u.raw_user_meta_data ->> 'name', 120) from auth.users u where u.id = v_usuario))
  where id = v_usuario;

  return 'PENDENTE';
end;
$$;

create function public.recusar_solicitacao_admin(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'apenas admin recusa pedidos' using errcode = '42501';
  end if;
  update public.perfis
  set solicitou_admin_em = null, admin_recusado_em = now()
  where id = p_usuario and papel = 'cliente';
end;
$$;

-- Aprovar continua sendo definir_admin(); agora ele também encerra o pedido.
create or replace function public.definir_admin(p_email text, p_admin boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_usuario uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.eh_admin() then
    raise exception 'apenas admin gerencia administradores' using errcode = '42501';
  end if;

  select id into v_usuario from auth.users where lower(email) = v_email;
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;

  if not p_admin and v_usuario = v_ator then
    return jsonb_build_object('ok', false, 'erro', 'PROPRIO_USUARIO');
  end if;

  insert into public.perfis (id, email, papel)
  values (v_usuario, v_email, case when p_admin then 'admin'::public.papel_usuario else 'cliente' end)
  on conflict (id) do update
    set papel = excluded.papel,
        email = coalesce(public.perfis.email, excluded.email),
        solicitou_admin_em = null,
        admin_recusado_em = case when p_admin then null else public.perfis.admin_recusado_em end;

  return jsonb_build_object('ok', true, 'usuario_id', v_usuario);
end;
$$;

revoke execute on function public.solicitar_admin(), public.recusar_solicitacao_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.solicitar_admin() to authenticated;
grant execute on function public.recusar_solicitacao_admin(uuid) to authenticated;
