-- Painel do admin: indicadores, gestão de usuários do app de placas e bloqueio.
-- Tudo aqui vale só dentro do app de placas; nada altera o login (auth.users),
-- que é compartilhado com a loja. Rodar uma vez no SQL Editor.

do $$
declare
  v_conflitos text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_conflitos
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('estatisticas_admin', 'admin_atualizar_usuario');
  if v_conflitos is not null then
    raise exception 'Já existem funções com estes nomes no schema public: %. Nada foi alterado.', v_conflitos;
  end if;
end;
$$;

alter table public.perfis add column bloqueado_em timestamptz;
alter table public.perfis add column telefone text check (char_length(telefone) <= 30);

-- Admin bloqueado perde o acesso na hora: eh_admin() passa a exigir não bloqueado.
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'admin' and bloqueado_em is null
  );
$$;

-- Indicadores do painel numa chamada só (evita trazer linhas para o navegador).
create function public.estatisticas_admin(p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dias integer := least(greatest(coalesce(p_dias, 30), 7), 365);
  v_inicio date := (now() at time zone 'America/Sao_Paulo')::date - (v_dias - 1);
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'placas', (select jsonb_build_object(
        'total', count(*),
        'ativas', count(*) filter (where status = 'ativa'),
        'aguardando', count(*) filter (where status = 'nao_ativada'),
        'bloqueadas', count(*) filter (where status = 'bloqueada'),
        'nfc_pendente', count(*) filter (where nfc_gravado_em is null)
      ) from public.placas),
    'clientes', (select count(*) from public.perfis where papel = 'cliente'
                   and exists (select 1 from public.placas pl where pl.dono_id = perfis.id)),
    'pedidos_admin', (select count(*) from public.perfis where papel = 'cliente' and solicitou_admin_em is not null),
    'leituras_periodo', (select count(*) from public.leituras
                           where (ocorrida_em at time zone 'America/Sao_Paulo')::date >= v_inicio),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'nfc', coalesce(l.nfc, 0), 'qr', coalesce(l.qr, 0)) order by d.dia), '[]'::jsonb)
      from generate_series(v_inicio, v_inicio + (v_dias - 1), interval '1 day') as d(dia)
      left join (
        select (ocorrida_em at time zone 'America/Sao_Paulo')::date as dia,
               count(*) filter (where origem = 'nfc') as nfc,
               count(*) filter (where origem <> 'nfc') as qr
        from public.leituras
        where (ocorrida_em at time zone 'America/Sao_Paulo')::date >= v_inicio
        group by 1
      ) l on l.dia = d.dia::date
    ),
    'top_placas', (
      select coalesce(jsonb_agg(t order by t.leituras desc), '[]'::jsonb) from (
        select pl.codigo, e.nome as empresa, count(l.id) as leituras
        from public.leituras l
        join public.placas pl on pl.id = l.placa_id
        left join public.empresas e on e.id = pl.empresa_id
        where (l.ocorrida_em at time zone 'America/Sao_Paulo')::date >= v_inicio
        group by pl.codigo, e.nome
        order by count(l.id) desc
        limit 5
      ) t
    )
  );
end;
$$;

-- Edição de usuário pelo admin: nome, papel e bloqueio no app de placas.
-- Ninguém tira o próprio acesso (evita ficar sem admin por engano).
create function public.admin_atualizar_usuario(
  p_usuario uuid,
  p_nome text,
  p_telefone text,
  p_papel public.papel_usuario,
  p_bloqueado boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_antes public.perfis%rowtype;
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_telefone text := nullif(regexp_replace(coalesce(p_telefone, ''), '[^0-9+() -]', '', 'g'), '');
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  if v_nome is not null and char_length(v_nome) > 120 then
    return jsonb_build_object('ok', false, 'erro', 'NOME_LONGO');
  end if;
  if v_telefone is not null and char_length(v_telefone) > 30 then
    return jsonb_build_object('ok', false, 'erro', 'TELEFONE_INVALIDO');
  end if;

  select * into v_antes from public.perfis where id = p_usuario for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;
  if p_usuario = v_ator and (p_papel <> 'admin' or p_bloqueado) then
    return jsonb_build_object('ok', false, 'erro', 'PROPRIO_USUARIO');
  end if;

  update public.perfis
  set nome = v_nome,
      telefone = v_telefone,
      papel = p_papel,
      bloqueado_em = case when p_bloqueado then coalesce(bloqueado_em, now()) else null end,
      solicitou_admin_em = case when p_papel = 'admin' then null else solicitou_admin_em end
  where id = p_usuario;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.estatisticas_admin(integer),
  public.admin_atualizar_usuario(uuid, text, text, public.papel_usuario, boolean)
  from public, anon, authenticated;
grant execute on function public.estatisticas_admin(integer) to authenticated;
grant execute on function public.admin_atualizar_usuario(uuid, text, text, public.papel_usuario, boolean) to authenticated;
