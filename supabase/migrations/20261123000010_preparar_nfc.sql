begin;

alter table public.placas
  add column preparada_nfc boolean not null default false,
  add column nfc_testada_em timestamptz,
  add column nfc_entregue_em timestamptz,
  add constraint placas_etapas_nfc check (
    (nfc_testada_em is null or (preparada_nfc and nfc_gravado_em is not null))
    and (nfc_entregue_em is null or nfc_testada_em is not null)
  );

create index placas_preparadas_nfc_idx on public.placas (criado_em desc, codigo desc)
  where preparada_nfc;

create policy placas_preservar_endereco_nfc on public.placas
  as restrictive for delete to authenticated
  using (not preparada_nfc or nfc_gravado_em is null);

create table public.placas_segredos_nfc (
  placa_id uuid primary key references public.placas (id) on delete cascade,
  hash text not null check (hash ~ '^[a-f0-9]{64}$'),
  ultima_consulta timestamptz
);

alter table public.placas_segredos_nfc enable row level security;
revoke all on public.placas_segredos_nfc from public, anon, authenticated;

create function public.placas_preparar_nfc(p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into strict v_id from public.criar_placas(array[p_codigo], null);
  update public.placas set preparada_nfc = true where id = v_id;
  return p_codigo;
end;
$$;

create function public.placas_etapa_nfc(p_codigo text, p_etapa text, p_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_placa public.placas%rowtype;
begin
  if not public.eh_admin() then
    raise insufficient_privilege;
  end if;

  select * into v_placa from public.placas
  where codigo = p_codigo and preparada_nfc for update;
  if not found or v_placa.status in ('ativa', 'desativada') then
    return false;
  end if;

  case p_etapa
    when 'gravada' then
      if v_placa.nfc_gravado_em is null then
        perform public.registrar_nfc(v_placa.id, false);
      end if;
    when 'testada' then
      if v_placa.nfc_gravado_em is null then return false; end if;
      update public.placas set nfc_testada_em = coalesce(nfc_testada_em, now())
      where id = v_placa.id;
    when 'entregue', 'novo_segredo' then
      if v_placa.nfc_testada_em is null or p_hash is null
        or (p_etapa = 'entregue' and v_placa.nfc_entregue_em is not null)
        or (p_etapa = 'novo_segredo' and v_placa.nfc_entregue_em is null)
      then return false; end if;

      insert into public.placas_segredos_nfc (placa_id, hash) values (v_placa.id, p_hash)
      on conflict (placa_id) do update set hash = excluded.hash, ultima_consulta = null;

      update public.placas set nfc_entregue_em = coalesce(nfc_entregue_em, now())
      where id = v_placa.id;
    else return false;
  end case;
  return true;
end;
$$;

-- Sempre revalida a credencial com a linha da placa bloqueada.
-- Dois caminhos: (1) titular de qualquer placa atribuída à própria conta (placa de lote ou
-- tag preparada); (2) tag preparada, entregue e ainda em estoque, com o código secreto.
create function public.placas_autorizar_nfc(p_codigo text, p_ator uuid, p_hash text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_placa public.placas%rowtype;
begin
  if p_ator is null then return null; end if;

  select * into v_placa from public.placas where codigo = p_codigo for update;
  if not found then return null; end if;

  if v_placa.status = 'atribuida' and v_placa.dono_id = p_ator then
    return v_placa.id;
  end if;

  if v_placa.preparada_nfc and v_placa.nfc_entregue_em is not null
    and v_placa.status = 'disponivel' and v_placa.dono_id is null and exists (
      select 1 from public.placas_segredos_nfc where placa_id = v_placa.id and hash = p_hash
    ) then
    return v_placa.id;
  end if;
  return null;
end;
$$;

create function public.placas_consultar_nfc(p_codigo text, p_ator uuid, p_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.placas_autorizar_nfc(p_codigo, p_ator, p_hash);
begin
  if v_id is null then return 'negada'; end if;
  -- Limite de 1 consulta a cada 2 s só existe no caminho do código secreto (há linha de segredo).
  if exists (select 1 from public.placas_segredos_nfc where placa_id = v_id) then
    update public.placas_segredos_nfc set ultima_consulta = now()
    where placa_id = v_id and
      (ultima_consulta is null or ultima_consulta <= now() - interval '2 seconds');
    if not found then return 'aguarde'; end if;
  end if;
  return 'ok';
end;
$$;

create function public.placas_ativar_nfc(
  p_codigo text, p_ator uuid, p_hash text, p_place_id text, p_nome text, p_link text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.placas_autorizar_nfc(p_codigo, p_ator, p_hash);
  v_resultado jsonb;
begin
  if v_id is null then return false; end if;

  -- Serializa a criação da mesma empresa por duas tags da mesma conta.
  perform 1 from public.perfis where id = p_ator for no key update;
  if not found then return false; end if;

  update public.placas set dono_id = p_ator, status = 'atribuida',
    atribuida_em = coalesce(atribuida_em, now())
  where id = v_id and dono_id is null;

  v_resultado := public.ativar_placa(p_codigo, 'google_places', p_place_id, p_nome, p_link, p_ator);
  if (v_resultado->>'ok') is distinct from 'true' then
    raise exception 'FALHA_ATIVACAO_NFC';
  end if;

  delete from public.placas_segredos_nfc where placa_id = v_id;
  return true;
end;
$$;

revoke execute on function public.placas_preparar_nfc(text),
  public.placas_etapa_nfc(text, text, text),
  public.placas_autorizar_nfc(text, uuid, text),
  public.placas_consultar_nfc(text, uuid, text),
  public.placas_ativar_nfc(text, uuid, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.placas_preparar_nfc(text),
  public.placas_etapa_nfc(text, text, text) to authenticated;
grant execute on function public.placas_consultar_nfc(text, uuid, text),
  public.placas_ativar_nfc(text, uuid, text, text, text, text) to service_role;

commit;
