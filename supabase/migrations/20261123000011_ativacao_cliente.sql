-- Ativação pelo cliente, como no fluxo de referência: o cliente lê a placa, entra com o
-- e-mail (ou cria a conta) e cadastra a empresa. A placa fica com o primeiro cliente
-- logado que concluir a ativação, desde que ela não esteja reservada, desativada ou
-- na conta de outra pessoa. Tags preparadas só depois de registradas como entregues.
-- Rodar uma vez no SQL Editor.

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('ativar_placa_cliente', 'email_tem_conta')
  ) then
    raise exception 'Já existe ativar_placa_cliente ou email_tem_conta. Nada foi alterado.';
  end if;
end;
$$;

-- Usado só pelo servidor para decidir entre "entrar" e "criar conta".
create function public.email_tem_conta(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where lower(email) = lower(btrim(coalesce(p_email, ''))));
$$;

create function public.ativar_placa_cliente(
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

  -- Placa de outra conta, reservada ou tag ainda não entregue: nega e registra.
  if not (
    v_placa.dono_id = p_ator
    or (v_placa.dono_id is null and v_placa.status::text = 'disponivel'
        and (not v_placa.preparada_nfc or v_placa.nfc_entregue_em is not null))
  ) then
    insert into public.historico_placa (placa_id, acao, depois, ator_id)
    values (v_placa.id, 'tentativa_negada', jsonb_build_object('motivo', 'placa de outra conta ou não liberada'), p_ator);
    return jsonb_build_object('ok', false, 'erro', 'NAO_E_SUA');
  end if;

  -- Bloco com desfazer: se a ativação falhar (link ou nome inválido), a placa não
  -- fica presa na conta de quem tentou.
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

    -- Valida link, nome e Place ID, cria a empresa e ativa (mesma regra de sempre).
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

revoke execute on function public.email_tem_conta(text),
  public.ativar_placa_cliente(text, uuid, public.origem_empresa, text, text, text)
  from public, anon, authenticated;
grant execute on function public.email_tem_conta(text),
  public.ativar_placa_cliente(text, uuid, public.origem_empresa, text, text, text)
  to service_role;
