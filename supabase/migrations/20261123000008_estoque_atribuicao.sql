-- Etapa 4: estoque com atribuição.
-- Status: disponivel (em estoque), reservada, atribuida (na conta de um cliente,
-- aguardando ativação), ativa, desativada. Só admin muda o estoque; o cliente só
-- ativa placa atribuída à conta dele e logado. Rodar uma vez no SQL Editor.

do $$
declare
  v_conflitos text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_conflitos
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in (
    'admin_atribuir_placas', 'admin_atribuir_do_lote', 'admin_reservar_placa',
    'admin_liberar_placa', 'admin_desativar_placa', 'admin_reativar_placa'
  );
  if v_conflitos is not null then
    raise exception 'Já existem funções com estes nomes no schema public: %. Nada foi alterado.', v_conflitos;
  end if;
end;
$$;

-- Renomear mantém as linhas existentes (nao_ativada vira disponivel, bloqueada vira desativada).
alter type public.status_placa rename value 'nao_ativada' to 'disponivel';
alter type public.status_placa rename value 'bloqueada' to 'desativada';
alter type public.status_placa add value if not exists 'reservada' after 'disponivel';
alter type public.status_placa add value if not exists 'atribuida' after 'reservada';

alter table public.placas add column reservada_para text check (char_length(reservada_para) <= 200);
alter table public.placas add column atribuida_em timestamptz;

-- Os valores novos do enum só podem ser usados depois do commit; por isso as
-- funções abaixo comparam status::text e nenhuma linha é migrada aqui.
create index placas_status_idx on public.placas (status);

alter table public.historico_placa drop constraint historico_placa_acao_check;
alter table public.historico_placa add constraint historico_placa_acao_check check (acao in (
  'criou', 'gravou_nfc', 'travou_nfc', 'ativou', 'trocou_destino',
  'bloqueou', 'desbloqueou', 'resetou', 'reivindicou',
  'reservou', 'atribuiu', 'liberou', 'desativou', 'reativou', 'tentativa_negada'
));

-- Ativação: só logado, só a placa atribuída à própria conta.
-- Tentativa em placa que não é da pessoa fica registrada no histórico (auditoria).
drop function if exists public.ativar_placa(text, public.origem_empresa, text, text, text, text, uuid);

create function public.ativar_placa(
  p_codigo text,
  p_origem public.origem_empresa,
  p_place_id text,
  p_nome text,
  p_link text,
  p_ator uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text := public.normalizar_codigo(p_codigo);
  v_nome text := btrim(coalesce(p_nome, ''));
  v_placa public.placas%rowtype;
  v_empresa uuid;
begin
  if p_ator is null then
    return jsonb_build_object('ok', false, 'erro', 'NAO_AUTENTICADO');
  end if;
  if char_length(v_nome) not between 1 and 200 then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS', 'campo', 'nome');
  end if;
  if not public.link_avaliacao_valido(p_link) then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS', 'campo', 'link');
  end if;
  if p_origem = 'google_places' and coalesce(p_place_id, '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS', 'campo', 'place_id');
  end if;

  select * into v_placa from public.placas where codigo = v_codigo for update;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADA');
  end if;
  if v_placa.dono_id is distinct from p_ator then
    insert into public.historico_placa (placa_id, acao, depois, ator_id)
    values (v_placa.id, 'tentativa_negada', jsonb_build_object('motivo', 'ativar placa de outra conta'), p_ator);
    -- Mesma resposta para "em estoque" e "de outra pessoa": não revela a situação da placa.
    return jsonb_build_object('ok', false, 'erro', 'NAO_E_SUA');
  end if;
  if v_placa.status::text = 'desativada' then
    return jsonb_build_object('ok', false, 'erro', 'DESATIVADA');
  end if;
  if v_placa.status::text = 'ativa' then
    return jsonb_build_object('ok', false, 'erro', 'JA_ATIVADA');
  end if;

  v_empresa := public.obter_ou_criar_empresa(p_ator, p_origem, nullif(p_place_id, ''), v_nome, p_link);

  update public.placas
  set status = 'ativa', empresa_id = v_empresa, destino_url = p_link, ativada_em = now()
  where id = v_placa.id;

  insert into public.historico_placa (placa_id, acao, antes, depois, ator_id)
  values (v_placa.id, 'ativou', jsonb_build_object('status', v_placa.status),
          jsonb_build_object('status', 'ativa', 'empresa_id', v_empresa, 'destino_url', p_link), p_ator);

  return jsonb_build_object('ok', true, 'placa_id', v_placa.id, 'empresa_id', v_empresa, 'destino_url', p_link);
end;
$$;

-- Atribui placas (por código) à conta de um cliente. Só placas em estoque ou reservadas.
create function public.admin_atribuir_placas(p_codigos text[], p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_ids uuid[];
  v_pedidos integer := coalesce(array_length(p_codigos, 1), 0);
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfis where id = p_usuario) then
    return jsonb_build_object('ok', false, 'erro', 'USUARIO_NAO_ENCONTRADO');
  end if;
  if v_pedidos not between 1 and 1000 then
    return jsonb_build_object('ok', false, 'erro', 'QUANTIDADE_INVALIDA');
  end if;

  with alvo as (
    select id from public.placas
    where codigo = any (select public.normalizar_codigo(c) from unnest(p_codigos) c)
      and status::text in ('disponivel', 'reservada')
    for update
  ), feito as (
    update public.placas p
    set status = 'atribuida', dono_id = p_usuario, atribuida_em = now(), reservada_para = null
    from alvo where p.id = alvo.id
    returning p.id
  )
  select coalesce(array_agg(id), '{}') into v_ids from feito;

  if coalesce(array_length(v_ids, 1), 0) <> v_pedidos then
    raise exception 'PLACA_INDISPONIVEL' using errcode = 'P0001',
      hint = 'Alguma placa não existe ou não está em estoque; nada foi atribuído.';
  end if;

  insert into public.historico_placa (placa_id, acao, depois, ator_id)
  select id, 'atribuiu', jsonb_build_object('dono_id', p_usuario), v_ator from unnest(v_ids) id;

  return jsonb_build_object('ok', true, 'quantidade', array_length(v_ids, 1));
end;
$$;

-- Atribui N placas em estoque de um lote (as mais antigas primeiro).
create function public.admin_atribuir_do_lote(p_lote uuid, p_usuario uuid, p_quantidade integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigos text[];
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  if coalesce(p_quantidade, 0) not between 1 and 1000 then
    return jsonb_build_object('ok', false, 'erro', 'QUANTIDADE_INVALIDA');
  end if;

  select array_agg(codigo) into v_codigos from (
    select codigo from public.placas
    where lote_id = p_lote and status::text = 'disponivel'
    order by criado_em, codigo
    limit p_quantidade
  ) s;

  if coalesce(array_length(v_codigos, 1), 0) < p_quantidade then
    return jsonb_build_object('ok', false, 'erro', 'ESTOQUE_INSUFICIENTE',
      'disponiveis', coalesce(array_length(v_codigos, 1), 0));
  end if;

  return public.admin_atribuir_placas(v_codigos, p_usuario);
end;
$$;

create function public.admin_reservar_placa(p_placa uuid, p_nota text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  if v_nota is null or char_length(v_nota) > 200 then
    return jsonb_build_object('ok', false, 'erro', 'NOTA_INVALIDA');
  end if;

  update public.placas set status = 'reservada', reservada_para = v_nota
  where id = p_placa and status::text = 'disponivel';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'ESTADO_INVALIDO');
  end if;

  insert into public.historico_placa (placa_id, acao, depois, ator_id)
  values (p_placa, 'reservou', jsonb_build_object('reservada_para', v_nota), (select auth.uid()));
  return jsonb_build_object('ok', true);
end;
$$;

-- Devolve ao estoque uma placa reservada ou atribuída que ainda não foi ativada.
create function public.admin_liberar_placa(p_placa uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.placas%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;

  select * into v_antes from public.placas where id = p_placa for update;
  if not found or v_antes.status::text not in ('reservada', 'atribuida') then
    return jsonb_build_object('ok', false, 'erro', 'ESTADO_INVALIDO');
  end if;

  update public.placas
  set status = 'disponivel', dono_id = null, atribuida_em = null, reservada_para = null
  where id = p_placa;

  insert into public.historico_placa (placa_id, acao, antes, ator_id)
  values (p_placa, 'liberou',
          jsonb_build_object('status', v_antes.status, 'dono_id', v_antes.dono_id, 'reservada_para', v_antes.reservada_para),
          (select auth.uid()));
  return jsonb_build_object('ok', true);
end;
$$;

-- Desativa qualquer placa: o NFC e o QR param de levar à avaliação.
create function public.admin_desativar_placa(p_placa uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.placas%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;

  select * into v_antes from public.placas where id = p_placa for update;
  if not found or v_antes.status::text = 'desativada' then
    return jsonb_build_object('ok', false, 'erro', 'ESTADO_INVALIDO');
  end if;

  update public.placas set status = 'desativada', destino_url = null where id = p_placa;

  insert into public.historico_placa (placa_id, acao, antes, depois, ator_id)
  values (p_placa, 'desativou',
          jsonb_build_object('status', v_antes.status, 'destino_url', v_antes.destino_url),
          jsonb_build_object('motivo', left(nullif(btrim(coalesce(p_motivo, '')), ''), 200)),
          (select auth.uid()));
  return jsonb_build_object('ok', true);
end;
$$;

-- Reativa voltando ao estado coerente com os dados: ativa (com empresa), atribuída (com dono) ou em estoque.
create function public.admin_reativar_placa(p_placa uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_placa public.placas%rowtype;
  v_link text;
  v_novo text;
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;

  select * into v_placa from public.placas where id = p_placa for update;
  if not found or v_placa.status::text <> 'desativada' then
    return jsonb_build_object('ok', false, 'erro', 'ESTADO_INVALIDO');
  end if;

  select link_avaliacao into v_link from public.empresas where id = v_placa.empresa_id;
  v_novo := case
    when v_link is not null then 'ativa'
    when v_placa.dono_id is not null then 'atribuida'
    else 'disponivel'
  end;

  update public.placas
  set status = v_novo::public.status_placa,
      destino_url = case when v_novo = 'ativa' then v_link end
  where id = p_placa;

  insert into public.historico_placa (placa_id, acao, depois, ator_id)
  values (p_placa, 'reativou', jsonb_build_object('status', v_novo), (select auth.uid()));
  return jsonb_build_object('ok', true, 'status', v_novo);
end;
$$;

-- Indicadores com os status novos.
create or replace function public.estatisticas_admin(p_dias integer default 30)
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
        'disponiveis', count(*) filter (where status::text = 'disponivel'),
        'reservadas', count(*) filter (where status::text = 'reservada'),
        'atribuidas', count(*) filter (where status::text = 'atribuida'),
        'ativas', count(*) filter (where status::text = 'ativa'),
        'desativadas', count(*) filter (where status::text = 'desativada'),
        'nfc_pendente', count(*) filter (where nfc_gravado_em is null and status::text <> 'desativada')
      ) from public.placas),
    'usuarios', (select count(*) from public.perfis),
    'empresas', (select count(*) from public.empresas),
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

revoke execute on function
  public.ativar_placa(text, public.origem_empresa, text, text, text, uuid),
  public.admin_atribuir_placas(text[], uuid),
  public.admin_atribuir_do_lote(uuid, uuid, integer),
  public.admin_reservar_placa(uuid, text),
  public.admin_liberar_placa(uuid),
  public.admin_desativar_placa(uuid, text),
  public.admin_reativar_placa(uuid)
from public, anon, authenticated;

grant execute on function public.ativar_placa(text, public.origem_empresa, text, text, text, uuid) to service_role;
grant execute on function
  public.admin_atribuir_placas(text[], uuid),
  public.admin_atribuir_do_lote(uuid, uuid, integer),
  public.admin_reservar_placa(uuid, text),
  public.admin_liberar_placa(uuid),
  public.admin_desativar_placa(uuid, text),
  public.admin_reativar_placa(uuid)
to authenticated;
