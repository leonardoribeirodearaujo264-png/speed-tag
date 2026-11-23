-- Etapa 5: redirecionamento /t/[codigo] e registro de acessos com código inexistente.
-- Leituras de placas existentes já vão para public.leituras (registrar_leitura).
-- Códigos que não existem vão para acessos_invalidos (auditoria: tentativas não autorizadas).
-- Rodar uma vez no SQL Editor.

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('registrar_acesso_invalido', 'resumo_redirecionamento')
  ) or to_regclass('public.acessos_invalidos') is not null then
    raise exception 'Já existe acessos_invalidos ou função com o mesmo nome. Nada foi alterado.';
  end if;
end;
$$;

create table public.acessos_invalidos (
  id bigint generated always as identity primary key,
  codigo_tentado text not null check (char_length(codigo_tentado) <= 32),
  ocorrida_em timestamptz not null default now(),
  dispositivo text check (dispositivo in ('mobile', 'desktop', 'outro')),
  pais text check (char_length(pais) <= 2)
);

create index acessos_invalidos_data_idx on public.acessos_invalidos (ocorrida_em desc);

alter table public.acessos_invalidos enable row level security;
revoke all on public.acessos_invalidos from anon;
revoke insert, update, delete on public.acessos_invalidos from authenticated;

create policy acessos_invalidos_admin on public.acessos_invalidos for select to authenticated
  using ((select public.eh_admin()));

-- Chamado pela rota do servidor (service_role). Guarda no máximo 32 caracteres do que foi digitado.
create function public.registrar_acesso_invalido(p_codigo text, p_dispositivo text default null, p_pais text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.acessos_invalidos (codigo_tentado, dispositivo, pais)
  values (
    left(coalesce(p_codigo, ''), 32),
    case when p_dispositivo in ('mobile', 'desktop', 'outro') then p_dispositivo end,
    case when p_pais ~ '^[A-Z]{2}$' then p_pais end
  );
$$;

-- O que a rota /t precisa saber da placa, numa consulta só (sem expor dono nem empresa).
create function public.resumo_redirecionamento(p_codigo text)
returns table (id uuid, codigo text, situacao text, destino_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.codigo, p.status::text, case when p.status::text = 'ativa' then p.destino_url end
  from public.placas p
  where p.codigo = public.normalizar_codigo(p_codigo);
$$;

revoke execute on function public.registrar_acesso_invalido(text, text, text), public.resumo_redirecionamento(text)
  from public, anon, authenticated;
grant execute on function public.registrar_acesso_invalido(text, text, text), public.resumo_redirecionamento(text)
  to service_role;
