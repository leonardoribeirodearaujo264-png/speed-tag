-- Controle de uso do Google Places: contador por janela de tempo (por IP, por usuário
-- e total do dia). Só o servidor (service_role) usa. Não altera tabelas existentes.
-- Rodar uma vez no SQL Editor.

do $$
begin
  if to_regclass('public.uso_google') is not null
     or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'consumir_cota_google') then
    raise exception 'uso_google ou consumir_cota_google já existe no schema public. Nada foi alterado.';
  end if;
end;
$$;

create table public.uso_google (
  chave text not null check (char_length(chave) between 1 and 120),
  janela_inicio timestamptz not null,
  quantidade integer not null default 0,
  primary key (chave, janela_inicio)
);

-- Sem políticas: ninguém lê ou escreve pelo navegador; só a função abaixo.
alter table public.uso_google enable row level security;
revoke all on public.uso_google from public, anon, authenticated;

-- Soma 1 na janela atual da chave e diz se ainda está dentro do limite.
create function public.consumir_cota_google(p_chave text, p_limite integer, p_janela_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz;
  v_quantidade integer;
begin
  if p_janela_segundos not between 1 and 604800 or p_limite < 0 then
    raise exception 'parametros invalidos';
  end if;
  v_inicio := to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);

  insert into public.uso_google as u (chave, janela_inicio, quantidade)
  values (p_chave, v_inicio, 1)
  on conflict (chave, janela_inicio) do update set quantidade = u.quantidade + 1
  returning u.quantidade into v_quantidade;

  -- Limpeza ocasional das janelas velhas, sem tarefa agendada.
  if random() < 0.02 then
    delete from public.uso_google where janela_inicio < now() - interval '3 days';
  end if;

  return v_quantidade <= p_limite;
end;
$$;

revoke execute on function public.consumir_cota_google(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_cota_google(text, integer, integer) to service_role;
