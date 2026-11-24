-- Corrige o login por código e a recuperação de senha de administradores.
--
-- garantir_perfil() fazia "insert ... on conflict do nothing". O gatilho BEFORE INSERT
-- speed_tag_proteger_perfil roda antes da checagem de conflito e vê a linha nova com o papel
-- padrão 'cliente'; para quem está em speed_tag_administradores isso dispara
-- insufficient_privilege, mesmo o perfil já existindo. Agora só insere quando não existe.
-- O mesmo vale para speed_tag_concluir_ativacoes(). Não altera dados.

create or replace function public.garantir_perfil()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.perfis (id, email)
  select u.id, lower(u.email) from auth.users u
  where u.id = (select auth.uid())
    and not exists (select 1 from public.perfis p where p.id = u.id)
  on conflict (id) do nothing;
$$;

create or replace function public.speed_tag_concluir_ativacoes()
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

  if not exists (select 1 from public.perfis where id = v_usuario) then
    insert into public.perfis (id, email) values (v_usuario, v_email) on conflict (id) do nothing;
  end if;

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
