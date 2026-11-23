-- Modelo da arte impressa em cada lote (arte do cliente: azul ou preta).
-- Lotes existentes ficam com "azul", o modelo que já aparecia por padrão.
-- Não apaga nada. Rodar uma vez no SQL Editor.

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'lotes' and column_name = 'modelo_arte') then
    raise exception 'A coluna lotes.modelo_arte já existe. Nada foi alterado.';
  end if;
end;
$$;

alter table public.lotes
  add column modelo_arte text not null default 'azul'
  constraint lotes_modelo_arte_check check (modelo_arte in ('azul', 'preta'));
