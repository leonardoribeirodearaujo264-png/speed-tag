-- Ativação direta, como no vídeo de referência: toda placa criada (em estoque, sem dono)
-- já pode ser ativada. O cliente escolhe a empresa e informa o e-mail no fim; a conta é
-- encontrada ou criada pelo servidor. Rodar uma vez no SQL Editor.

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'usuario_por_email'
  ) then
    raise exception 'Já existe public.usuario_por_email. Nada foi alterado.';
  end if;
end;
$$;

-- Usado só pelo servidor para vincular a placa à conta do e-mail informado.
create function public.usuario_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(btrim(coalesce(p_email, ''))) limit 1;
$$;

-- Mesma função da 0011, sem exigir "entrega registrada" nas tags do Preparar NFC.
create or replace function public.ativar_placa_cliente(
  p_codigo text,
  p_ator uuid,
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
  v_codigo text := public.normalizar_codigo(p_codigo);
  v_placa public.placas%rowtype;
  v_resultado jsonb;
begin
  if p_ator is null then
    return jsonb_build_object('ok', false, 'erro', 'NAO_AUTENTICADO');
  end if;

  select * into v_placa from public.placas where codigo = v_codigo for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADA');
  end if;
  if v_placa.status::text = 'ativa' then
    return jsonb_build_object('ok', false, 'erro', 'JA_ATIVADA');
  end if;
  if v_placa.status::text = 'desativada' then
    return jsonb_build_object('ok', false, 'erro', 'DESATIVADA');
  end if;

  -- Só placa livre (em estoque, sem dono) ou já atribuída a esta conta.
  if not (v_placa.dono_id = p_ator or (v_placa.dono_id is null and v_placa.status::text = 'disponivel')) then
    insert into public.historico_placa (placa_id, acao, depois, ator_id)
    values (v_placa.id, 'tentativa_negada', jsonb_build_object('motivo', 'placa de outra conta ou reservada'), p_ator);
    return jsonb_build_object('ok', false, 'erro', 'NAO_E_SUA');
  end if;

  begin
    if v_placa.dono_id is null then
      perform 1 from public.perfis where id = p_ator for no key update;
      if not found then
        v_resultado := jsonb_build_object('ok', false, 'erro', 'SEM_PERFIL');
        raise exception 'ATIVACAO_CLIENTE_FALHOU';
      end if;
      update public.placas
      set dono_id = p_ator, status = 'atribuida', atribuida_em = now()
      where id = v_placa.id;
      insert into public.historico_placa (placa_id, acao, depois, ator_id)
      values (v_placa.id, 'atribuiu', jsonb_build_object('dono_id', p_ator, 'origem', 'ativacao_cliente'), p_ator);
    end if;

    v_resultado := public.ativar_placa(v_codigo, p_origem, p_place_id, p_nome, p_link, p_ator);
    if (v_resultado ->> 'ok') is distinct from 'true' then
      raise exception 'ATIVACAO_CLIENTE_FALHOU';
    end if;
  exception when raise_exception then
    if sqlerrm = 'ATIVACAO_CLIENTE_FALHOU' then
      return v_resultado;
    end if;
    raise;
  end;

  return v_resultado;
end;
$$;

revoke execute on function public.usuario_por_email(text) from public, anon, authenticated;
grant execute on function public.usuario_por_email(text) to service_role;
