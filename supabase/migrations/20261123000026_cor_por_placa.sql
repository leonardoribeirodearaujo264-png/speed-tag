-- Cor da arte por placa: um mesmo lote pode ter placas azuis e pretas.
-- placas.modelo_arte vazio = vale a cor do lote (lotes.modelo_arte), como antes.
-- Só adiciona coluna e função; não altera dados existentes.

alter table public.placas
  add column if not exists modelo_arte text
  constraint placas_modelo_arte_check check (modelo_arte is null or modelo_arte in ('azul', 'preta'));

-- Define a cor de várias placas de uma vez (null = volta a usar a cor do lote). Só ADM.
create or replace function public.speed_tag_definir_cor_placas(p_codigos text[], p_modelo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  if not public.eh_admin() then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  if p_modelo is not null and p_modelo not in ('azul', 'preta') then
    raise exception 'modelo inválido' using errcode = '22023';
  end if;
  update public.placas set modelo_arte = p_modelo where codigo = any(coalesce(p_codigos, '{}'));
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.speed_tag_definir_cor_placas(text[], text) from public, anon;
grant execute on function public.speed_tag_definir_cor_placas(text[], text) to authenticated;
