-- Ativação da placa só com o e-mail (fluxo do NFC).
--
-- 1. A tela pública grava aqui o pedido (placa + empresa escolhida + e-mail) e o Supabase Auth
--    manda o e-mail de confirmação. Nenhuma conta ganha a placa antes de confirmar o e-mail.
-- 2. Depois que o Auth confirma o e-mail (link de uso único), o servidor chama
--    speed_tag_concluir_ativacoes(), que ativa os pedidos daquele e-mail com a regra de sempre
--    (ativar_placa_cliente: placa livre ou já desta conta).
-- 3. speed_tag_registrar_envio() limita os reenvios de e-mail por endereço.
--
-- Não apaga nem altera dados existentes. Rodar uma vez no SQL Editor.

do $$
begin
  if to_regclass('public.speed_tag_ativacoes_pendentes') is not null then
    raise exception 'A migração 0022 já foi aplicada. Nada foi alterado.';
  end if;
end;
$$;

create table public.speed_tag_ativacoes_pendentes (
  id uuid primary key default gen_random_uuid(),
  placa_id uuid not null references public.placas (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  conta_nova boolean not null,
  origem public.origem_empresa not null,
  place_id text check (place_id is null or char_length(place_id) <= 300),
  nome text not null check (char_length(btrim(nome)) between 1 and 200),
  link text not null check (char_length(link) <= 2048),
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '48 hours',
  concluida_em timestamptz,
  usuario_id uuid references auth.users (id) on delete set null,
  resultado text
);

create index speed_tag_ativacoes_pendentes_email on public.speed_tag_ativacoes_pendentes (email) where concluida_em is null;
create index speed_tag_ativacoes_pendentes_placa on public.speed_tag_ativacoes_pendentes (placa_id, criada_em desc);

alter table public.speed_tag_ativacoes_pendentes enable row level security;
revoke all on public.speed_tag_ativacoes_pendentes from public, anon, authenticated;

create table public.speed_tag_envios_email (
  id bigint generated always as identity primary key,
  email text not null,
  tipo text not null check (tipo in ('ativacao', 'reenvio_admin', 'cadastro')),
  enviado_em timestamptz not null default now()
);
create index speed_tag_envios_email_busca on public.speed_tag_envios_email (email, enviado_em desc);
alter table public.speed_tag_envios_email enable row level security;
revoke all on public.speed_tag_envios_email from public, anon, authenticated;

-- Conta o envio só se couber no limite (atômico por e-mail). Só o servidor chama.
create function public.speed_tag_registrar_envio(p_email text, p_tipo text, p_limite integer, p_janela_minutos integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email = '' or p_limite < 1 or p_janela_minutos < 1 then return false; end if;
  perform pg_advisory_xact_lock(hashtext('speed_tag_envio:' || v_email));
  if (select count(*) from public.speed_tag_envios_email
      where email = v_email and enviado_em > now() - make_interval(mins => p_janela_minutos)) >= p_limite then
    return false;
  end if;
  insert into public.speed_tag_envios_email (email, tipo) values (v_email, p_tipo);
  return true;
end;
$$;
revoke execute on function public.speed_tag_registrar_envio(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.speed_tag_registrar_envio(text, text, integer, integer) to service_role;

-- Conclui os pedidos do e-mail confirmado de quem está logado. O primeiro e-mail confirmado
-- leva a placa; pedidos de outros e-mails para a mesma placa param em JA_ATIVADA/NAO_E_SUA.
create function public.speed_tag_concluir_ativacoes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_email text;
  v_pedido public.speed_tag_ativacoes_pendentes%rowtype;
  v_codigo text;
  v_resultado jsonb;
  v_ativadas text[] := '{}';
  v_recusadas text[] := '{}';
begin
  if v_usuario is null then return jsonb_build_object('ativadas', '[]'::jsonb, 'recusadas', '[]'::jsonb); end if;

  select lower(email) into v_email from auth.users where id = v_usuario and email_confirmed_at is not null;
  if v_email is null then return jsonb_build_object('ativadas', '[]'::jsonb, 'recusadas', '[]'::jsonb); end if;

  insert into public.perfis (id, email) values (v_usuario, v_email) on conflict (id) do nothing;

  for v_pedido in
    select * from public.speed_tag_ativacoes_pendentes
    where email = v_email and concluida_em is null and expira_em > now()
    order by criada_em
    for update skip locked
  loop
    select codigo into v_codigo from public.placas where id = v_pedido.placa_id;
    v_resultado := public.ativar_placa_cliente(v_codigo, v_usuario, v_pedido.origem, v_pedido.place_id, v_pedido.nome, v_pedido.link);
    update public.speed_tag_ativacoes_pendentes
      set concluida_em = now(), usuario_id = v_usuario,
          resultado = case when (v_resultado ->> 'ok') = 'true' then 'ativada' else coalesce(v_resultado ->> 'erro', 'ERRO') end
      where id = v_pedido.id;
    if (v_resultado ->> 'ok') = 'true' then
      v_ativadas := array_append(v_ativadas, v_codigo);
    else
      v_recusadas := array_append(v_recusadas, v_codigo);
    end if;
  end loop;

  return jsonb_build_object('ativadas', to_jsonb(v_ativadas), 'recusadas', to_jsonb(v_recusadas));
end;
$$;
revoke execute on function public.speed_tag_concluir_ativacoes() from public, anon;
grant execute on function public.speed_tag_concluir_ativacoes() to authenticated;
