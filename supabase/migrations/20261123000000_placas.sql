-- App de placas de avaliação: banco completo em um arquivo só.
-- Instalação do zero: cole inteiro no Supabase (SQL Editor > New query > Run) e rode uma vez.
-- O banco é compartilhado com a loja: a trava do início aborta tudo, sem alterar nada,
-- se já existir função com algum dos nomes usados aqui.

-- ============================================================
-- 1. Tabelas
-- ============================================================

-- Esquema inicial: tipos, tabelas, índices e gatilhos de atualização.

-- Este banco é compartilhado com outro sistema (loja). As funções abaixo usam
-- "create or replace", que sobrescreveria em silêncio uma função de mesmo nome
-- da loja. Esta trava aborta tudo antes de qualquer mudança se houver conflito.
-- Tabelas, tipos e gatilhos já falham sozinhos se o nome existir.
do $$
declare
  v_conflitos text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_conflitos
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'placas_tocar_atualizado_em', 'normalizar_codigo', 'link_avaliacao_valido', 'eh_admin',
      'criar_perfil_novo_usuario', 'garantir_perfil', 'obter_ou_criar_empresa', 'ativar_placa',
      'registrar_leitura', 'trocar_destino', 'reivindicar_placas',
      'criar_placas', 'criar_lote', 'registrar_nfc', 'definir_admin'
    );
  if v_conflitos is not null then
    raise exception 'Já existem funções com estes nomes no schema public: %. Nada foi alterado.', v_conflitos;
  end if;
end;
$$;

create extension if not exists pgcrypto;

create type public.status_placa as enum ('nao_ativada', 'ativa', 'bloqueada');
create type public.origem_empresa as enum ('google_places', 'manual');
create type public.origem_leitura as enum ('nfc', 'qr', 'desconhecida');
create type public.papel_usuario as enum ('cliente', 'admin');

-- Atualiza a coluna atualizado_em em qualquer UPDATE.
create or replace function public.placas_tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text check (char_length(nome) <= 120),
  email text,
  papel public.papel_usuario not null default 'cliente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 120),
  quantidade integer not null check (quantidade between 1 and 10000),
  revendedor text check (char_length(revendedor) <= 120),
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid references public.perfis (id) on delete set null,
  origem public.origem_empresa not null,
  google_place_id text check (char_length(google_place_id) <= 300),
  nome text not null check (char_length(nome) between 1 and 200),
  link_avaliacao text not null check (char_length(link_avaliacao) <= 2048),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint empresas_google_exige_place_id
    check (origem <> 'google_places' or google_place_id is not null)
);

-- O mesmo dono não duplica a mesma empresa do Google ao ativar várias placas.
create unique index empresas_dono_place_unico
  on public.empresas (dono_id, google_place_id)
  where google_place_id is not null and dono_id is not null;

create table public.placas (
  id uuid primary key default gen_random_uuid(),
  -- Crockford Base32 sem I, L, O, U; 6 caracteres. Mesmo alfabeto de src/lib/codigos.ts.
  codigo text not null unique check (codigo ~ '^[0-9A-HJKMNP-TV-Z]{6}$'),
  lote_id uuid references public.lotes (id) on delete set null,
  status public.status_placa not null default 'nao_ativada',
  empresa_id uuid references public.empresas (id) on delete set null,
  dono_id uuid references public.perfis (id) on delete set null,
  destino_url text check (char_length(destino_url) <= 2048),
  email_ativacao text check (char_length(email_ativacao) <= 254),
  criada_por uuid references public.perfis (id) on delete set null,
  nfc_gravado_em timestamptz,
  nfc_travado boolean not null default false,
  ativada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint placas_ativa_tem_destino check ((status = 'ativa') = (destino_url is not null))
);

create index placas_dono_idx on public.placas (dono_id);
create index placas_lote_idx on public.placas (lote_id);
create index placas_email_ativacao_idx on public.placas (lower(email_ativacao))
  where dono_id is null and email_ativacao is not null;

create table public.leituras (
  id bigint generated always as identity primary key,
  placa_id uuid not null references public.placas (id) on delete cascade,
  ocorrida_em timestamptz not null default now(),
  origem public.origem_leitura not null,
  dispositivo text check (dispositivo in ('mobile', 'desktop', 'outro')),
  pais text check (char_length(pais) <= 2)
);

create index leituras_placa_data_idx on public.leituras (placa_id, ocorrida_em desc);

create table public.historico_placa (
  id bigint generated always as identity primary key,
  placa_id uuid not null references public.placas (id) on delete cascade,
  acao text not null check (acao in (
    'criou', 'gravou_nfc', 'travou_nfc', 'ativou', 'trocou_destino',
    'bloqueou', 'desbloqueou', 'resetou', 'reivindicou'
  )),
  antes jsonb,
  depois jsonb,
  ator_id uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create index historico_placa_idx on public.historico_placa (placa_id, criado_em desc);

create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function public.placas_tocar_atualizado_em();
create trigger empresas_atualizado_em before update on public.empresas
  for each row execute function public.placas_tocar_atualizado_em();
create trigger placas_atualizado_em before update on public.placas
  for each row execute function public.placas_tocar_atualizado_em();

-- ============================================================
-- 2. Funções de ativação, leitura e destino
-- ============================================================

-- Funções de domínio. Todas com search_path vazio e nomes qualificados.
-- As funções públicas de escrita (ativar, registrar leitura) só podem ser
-- chamadas pela service_role, ou seja, pelas rotas do servidor, que aplicam
-- rate limit e validação antes. Nunca liberar para anon.

-- Normaliza o código digitado ou lido: maiúsculas, sem espaços e hífens,
-- O vira 0, I e L viram 1 (Crockford). Espelha normalizarCodigo() em src/lib/codigos.ts.
create or replace function public.normalizar_codigo(p_codigo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(upper(regexp_replace(coalesce(p_codigo, ''), '[\s-]', '', 'g')), 'OIL', '011');
$$;

-- Defesa em profundidade: só links do Google podem virar destino de placa.
-- A lista oficial fica em src/lib/google/dominios.ts; mantenha as duas iguais.
create or replace function public.link_avaliacao_valido(p_link text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_link, '') ~ (
    '^https://('
    || 'search\.google\.com/'
    || '|www\.google\.com(\.br)?/maps([/?]|$)'
    || '|maps\.google\.com(\.br)?/'
    || '|g\.page/'
    || '|maps\.app\.goo\.gl/'
    || '|goo\.gl/maps/'
    || ')'
  )
  and char_length(p_link) <= 2048;
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'admin'
  );
$$;

-- Cria o perfil quando um usuário se cadastra no Supabase Auth.
-- O Auth é compartilhado com a loja: se este gatilho falhasse, o cadastro na
-- loja falharia junto. Por isso ele nunca lança erro; o perfil que faltar é
-- criado depois por garantir_perfil() no primeiro login no app de placas.
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.perfis (id, email, nome)
    values (new.id, lower(new.email), left(new.raw_user_meta_data ->> 'name', 120))
    on conflict (id) do nothing;
  exception when others then
    raise warning 'criar_perfil_novo_usuario falhou para %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Garante o perfil do usuário logado (usuários que já existiam na loja antes
-- deste app não passaram pelo gatilho acima). Chamada no login.
create or replace function public.garantir_perfil()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.perfis (id, email)
  select u.id, lower(u.email) from auth.users u where u.id = (select auth.uid())
  on conflict (id) do nothing;
$$;

create trigger placas_ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Encontra ou cria a empresa do dono. Sem dono, sempre cria uma nova
-- (a ativação pública não pode reaproveitar empresa de outra pessoa).
create or replace function public.obter_ou_criar_empresa(
  p_dono uuid,
  p_origem public.origem_empresa,
  p_place_id text,
  p_nome text,
  p_link text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_dono is not null and p_place_id is not null then
    select id into v_id
    from public.empresas
    where dono_id = p_dono and google_place_id = p_place_id;

    if v_id is not null then
      update public.empresas
      set nome = p_nome, link_avaliacao = p_link
      where id = v_id;
      return v_id;
    end if;
  end if;

  insert into public.empresas (dono_id, origem, google_place_id, nome, link_avaliacao)
  values (p_dono, p_origem, p_place_id, p_nome, p_link)
  returning id into v_id;

  return v_id;
end;
$$;

-- Ativação atômica. O SELECT ... FOR UPDATE serializa toques simultâneos:
-- o segundo espera o primeiro terminar e recebe JA_ATIVADA.
-- p_ator é o usuário logado (verificado pela rota do servidor) ou null.
create or replace function public.ativar_placa(
  p_codigo text,
  p_origem public.origem_empresa,
  p_place_id text,
  p_nome text,
  p_link text,
  p_email text default null,
  p_ator uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text := public.normalizar_codigo(p_codigo);
  v_nome text := btrim(coalesce(p_nome, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_placa public.placas%rowtype;
  v_empresa uuid;
begin
  if char_length(v_nome) not between 1 and 200 then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS', 'campo', 'nome');
  end if;
  if not public.link_avaliacao_valido(p_link) then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS', 'campo', 'link');
  end if;
  if p_origem = 'google_places' and coalesce(p_place_id, '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS', 'campo', 'place_id');
  end if;
  if v_email is not null and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254) then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS', 'campo', 'email');
  end if;

  select * into v_placa from public.placas where codigo = v_codigo for update;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADA');
  elsif v_placa.status = 'bloqueada' then
    return jsonb_build_object('ok', false, 'erro', 'BLOQUEADA');
  elsif v_placa.status = 'ativa' then
    return jsonb_build_object('ok', false, 'erro', 'JA_ATIVADA');
  end if;

  v_empresa := public.obter_ou_criar_empresa(
    p_ator, p_origem, nullif(p_place_id, ''), v_nome, p_link
  );

  update public.placas
  set status = 'ativa',
      empresa_id = v_empresa,
      dono_id = coalesce(p_ator, dono_id),
      destino_url = p_link,
      email_ativacao = v_email,
      ativada_em = now()
  where id = v_placa.id;

  insert into public.historico_placa (placa_id, acao, antes, depois, ator_id)
  values (
    v_placa.id,
    'ativou',
    jsonb_build_object('status', v_placa.status),
    jsonb_build_object('status', 'ativa', 'empresa_id', v_empresa, 'destino_url', p_link, 'origem', p_origem),
    p_ator
  );

  return jsonb_build_object(
    'ok', true,
    'placa_id', v_placa.id,
    'empresa_id', v_empresa,
    'destino_url', p_link
  );
end;
$$;

-- Registro de leitura chamado pela rota /t/[codigo] fora do caminho crítico.
create or replace function public.registrar_leitura(
  p_placa_id uuid,
  p_origem public.origem_leitura,
  p_dispositivo text default null,
  p_pais text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.leituras (placa_id, origem, dispositivo, pais)
  values (
    p_placa_id,
    p_origem,
    case when p_dispositivo in ('mobile', 'desktop', 'outro') then p_dispositivo end,
    case when p_pais ~ '^[A-Z]{2}$' then p_pais end
  );
$$;

-- Troca o destino de uma placa ativa. Só o dono logado ou um admin.
create or replace function public.trocar_destino(
  p_placa_id uuid,
  p_origem public.origem_empresa,
  p_place_id text,
  p_nome text,
  p_link text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_nome text := btrim(coalesce(p_nome, ''));
  v_placa public.placas%rowtype;
  v_empresa uuid;
begin
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'erro', 'NAO_AUTENTICADO');
  end if;
  if char_length(v_nome) not between 1 and 200 or not public.link_avaliacao_valido(p_link) then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS');
  end if;
  if p_origem = 'google_places' and coalesce(p_place_id, '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS', 'campo', 'place_id');
  end if;

  select * into v_placa from public.placas where id = p_placa_id for update;

  if not found or (v_placa.dono_id is distinct from v_usuario and not public.eh_admin()) then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADA');
  elsif v_placa.status <> 'ativa' then
    return jsonb_build_object('ok', false, 'erro', 'PLACA_NAO_ATIVA');
  end if;

  v_empresa := public.obter_ou_criar_empresa(
    coalesce(v_placa.dono_id, v_usuario), p_origem, nullif(p_place_id, ''), v_nome, p_link
  );

  update public.placas
  set empresa_id = v_empresa, destino_url = p_link
  where id = v_placa.id;

  insert into public.historico_placa (placa_id, acao, antes, depois, ator_id)
  values (
    v_placa.id,
    'trocou_destino',
    jsonb_build_object('empresa_id', v_placa.empresa_id, 'destino_url', v_placa.destino_url),
    jsonb_build_object('empresa_id', v_empresa, 'destino_url', p_link),
    v_usuario
  );

  return jsonb_build_object('ok', true, 'empresa_id', v_empresa, 'destino_url', p_link);
end;
$$;

-- O usuário logado, com e-mail confirmado, assume as placas ativadas com o
-- e-mail dele que ainda não têm dono. Retorna quantas placas foram assumidas.
create or replace function public.reivindicar_placas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_email text;
  v_total integer := 0;
  v_placa record;
begin
  if v_usuario is null then
    return 0;
  end if;

  select lower(email) into v_email
  from auth.users
  where id = v_usuario and email_confirmed_at is not null;

  if v_email is null then
    return 0;
  end if;

  for v_placa in
    select id, empresa_id from public.placas
    where dono_id is null and lower(email_ativacao) = v_email
    for update
  loop
    update public.placas set dono_id = v_usuario where id = v_placa.id;
    update public.empresas set dono_id = v_usuario
      where id = v_placa.empresa_id and dono_id is null;
    insert into public.historico_placa (placa_id, acao, depois, ator_id)
      values (v_placa.id, 'reivindicou', jsonb_build_object('dono_id', v_usuario), v_usuario);
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- Permissões: fecha só as funções deste app (nunca "all functions in schema",
-- que mexeria em funções de outros sistemas no mesmo banco) e libera onde precisa.
revoke execute on function
  public.placas_tocar_atualizado_em(),
  public.normalizar_codigo(text),
  public.link_avaliacao_valido(text),
  public.eh_admin(),
  public.criar_perfil_novo_usuario(),
  public.garantir_perfil(),
  public.obter_ou_criar_empresa(uuid, public.origem_empresa, text, text, text),
  public.ativar_placa(text, public.origem_empresa, text, text, text, text, uuid),
  public.registrar_leitura(uuid, public.origem_leitura, text, text),
  public.trocar_destino(uuid, public.origem_empresa, text, text, text),
  public.reivindicar_placas()
from public, anon, authenticated;

grant execute on function public.normalizar_codigo(text) to anon, authenticated, service_role;
grant execute on function public.link_avaliacao_valido(text) to anon, authenticated, service_role;
grant execute on function public.eh_admin() to authenticated, service_role;
grant execute on function public.trocar_destino(uuid, public.origem_empresa, text, text, text) to authenticated;
grant execute on function public.reivindicar_placas() to authenticated;
grant execute on function public.garantir_perfil() to authenticated;
grant execute on function public.ativar_placa(text, public.origem_empresa, text, text, text, text, uuid) to service_role;
grant execute on function public.registrar_leitura(uuid, public.origem_leitura, text, text) to service_role;
grant execute on function public.obter_ou_criar_empresa(uuid, public.origem_empresa, text, text, text) to service_role;

-- ============================================================
-- 3. Regras de acesso (RLS)
-- ============================================================

-- Row Level Security. Nenhuma tabela tem leitura pública: as rotas públicas
-- (/t, /ativar) passam pelo servidor com service_role e pelas funções acima.

alter table public.perfis enable row level security;
alter table public.lotes enable row level security;
alter table public.empresas enable row level security;
alter table public.placas enable row level security;
alter table public.leituras enable row level security;
alter table public.historico_placa enable row level security;

-- anon não acessa nenhuma tabela diretamente.
revoke all on public.perfis, public.lotes, public.empresas, public.placas,
  public.leituras, public.historico_placa from anon;

-- perfis: cada um vê o seu; admin vê todos. O usuário só edita o próprio nome
-- (sem isso ele poderia se promover a admin mudando a coluna papel).
create policy perfis_select on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.eh_admin()));

revoke insert, update, delete on public.perfis from authenticated;
grant update (nome) on public.perfis to authenticated;

create policy perfis_update_proprio on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- lotes: só admin.
create policy lotes_admin on public.lotes for all to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

-- empresas: dono lê; escrita do cliente só pelas funções; admin tudo.
create policy empresas_select on public.empresas for select to authenticated
  using (dono_id = (select auth.uid()) or (select public.eh_admin()));

create policy empresas_admin_escrita on public.empresas for all to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

-- placas: dono lê as suas; só admin cria, altera e apaga.
-- O cliente troca destino por trocar_destino(), nunca por UPDATE direto.
create policy placas_select on public.placas for select to authenticated
  using (dono_id = (select auth.uid()) or (select public.eh_admin()));

create policy placas_admin_escrita on public.placas for all to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

-- leituras: dono lê as leituras das próprias placas. Inserção só por registrar_leitura().
create policy leituras_select on public.leituras for select to authenticated
  using (
    (select public.eh_admin())
    or exists (
      select 1 from public.placas p
      where p.id = leituras.placa_id and p.dono_id = (select auth.uid())
    )
  );

revoke insert, update, delete on public.leituras from authenticated;

-- histórico: dono lê o das próprias placas; admin lê tudo. Escrita só pelas funções.
create policy historico_select on public.historico_placa for select to authenticated
  using (
    (select public.eh_admin())
    or exists (
      select 1 from public.placas p
      where p.id = historico_placa.placa_id and p.dono_id = (select auth.uid())
    )
  );

revoke insert, update, delete on public.historico_placa from authenticated;

-- ============================================================
-- 4. Criação de placas, lotes e NFC
-- ============================================================

-- Etapa 2: criação de placas e lotes pelo admin e registro da gravação NFC.
-- Os códigos são gerados no servidor (src/lib/codigos.ts, crypto seguro) e
-- passados aqui. Se algum já existir, a função aborta com COLISAO_CODIGO e
-- nada é gravado; o servidor gera outros e tenta de novo.

create or replace function public.criar_placas(
  p_codigos text[],
  p_lote_id uuid default null
)
returns setof public.placas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_pedidos integer := coalesce(array_length(p_codigos, 1), 0);
  v_criadas integer;
  v_ids uuid[];
begin
  if not public.eh_admin() then
    raise exception 'apenas admin cria placas' using errcode = '42501';
  end if;
  if v_pedidos not between 1 and 10000 then
    raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
  end if;
  if (select count(distinct c) from unnest(p_codigos) c) <> v_pedidos then
    raise exception 'CODIGOS_REPETIDOS' using errcode = '22023';
  end if;

  with inseridas as (
    insert into public.placas (codigo, lote_id, criada_por)
    select c, p_lote_id, v_usuario from unnest(p_codigos) c
    on conflict (codigo) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from inseridas;

  v_criadas := coalesce(array_length(v_ids, 1), 0);
  if v_criadas <> v_pedidos then
    raise exception 'COLISAO_CODIGO' using errcode = '23505';
  end if;

  insert into public.historico_placa (placa_id, acao, depois, ator_id)
  select id, 'criou', jsonb_build_object('lote_id', p_lote_id), v_usuario
  from unnest(v_ids) id;

  return query
    select p.* from public.placas p where p.id = any (v_ids) order by p.codigo;
end;
$$;

-- Cria o lote e as placas na mesma transação: ou tudo, ou nada.
create or replace function public.criar_lote(
  p_nome text,
  p_codigos text[],
  p_revendedor text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lote uuid;
begin
  if not public.eh_admin() then
    raise exception 'apenas admin cria lotes' using errcode = '42501';
  end if;

  insert into public.lotes (nome, quantidade, revendedor, criado_por)
  values (btrim(p_nome), coalesce(array_length(p_codigos, 1), 0),
          nullif(btrim(coalesce(p_revendedor, '')), ''), (select auth.uid()))
  returning id into v_lote;

  perform public.criar_placas(p_codigos, v_lote);
  return v_lote;
end;
$$;

-- Registra que o chip foi gravado (e conferido por leitura) e, opcionalmente, travado.
-- Travar é irreversível no chip, então aqui também só vai de false para true.
create or replace function public.registrar_nfc(
  p_placa_id uuid,
  p_travado boolean default false
)
returns public.placas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_placa public.placas%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'apenas admin registra NFC' using errcode = '42501';
  end if;

  update public.placas
  set nfc_gravado_em = now(),
      nfc_travado = nfc_travado or coalesce(p_travado, false)
  where id = p_placa_id
  returning * into v_placa;

  if not found then
    raise exception 'NAO_ENCONTRADA' using errcode = 'P0002';
  end if;

  insert into public.historico_placa (placa_id, acao, depois, ator_id)
  values (
    p_placa_id,
    case when p_travado then 'travou_nfc' else 'gravou_nfc' end,
    jsonb_build_object('nfc_travado', v_placa.nfc_travado),
    v_usuario
  );

  return v_placa;
end;
$$;

revoke execute on function
  public.criar_placas(text[], uuid),
  public.criar_lote(text, text[], text),
  public.registrar_nfc(uuid, boolean)
from public, anon, authenticated;

grant execute on function public.criar_placas(text[], uuid) to authenticated;
grant execute on function public.criar_lote(text, text[], text) to authenticated;
grant execute on function public.registrar_nfc(uuid, boolean) to authenticated;

-- ============================================================
-- 5. Administradores
-- ============================================================

-- Cadastro de administradores pelo próprio painel.
-- A criação do usuário no Auth (e-mail + senha) é feita pelo servidor com a
-- secret key; esta função só dá ou tira o papel de admin de um usuário existente.


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

  -- Impede ficar sem nenhum admin por engano: ninguém remove o próprio acesso.
  if not p_admin and v_usuario = v_ator then
    return jsonb_build_object('ok', false, 'erro', 'PROPRIO_USUARIO');
  end if;

  insert into public.perfis (id, email, papel)
  values (v_usuario, v_email, case when p_admin then 'admin'::public.papel_usuario else 'cliente' end)
  on conflict (id) do update
    set papel = excluded.papel, email = coalesce(public.perfis.email, excluded.email);

  return jsonb_build_object('ok', true, 'usuario_id', v_usuario);
end;
$$;

revoke execute on function public.definir_admin(text, boolean) from public, anon, authenticated;
grant execute on function public.definir_admin(text, boolean) to authenticated;
