-- Caixa do cliente (aba "Caixa" do painel das empresas): vendas e compras de estoque.
-- Cada conta vê e mexe só nos próprios lançamentos (RLS por dono_id = auth.uid()).
-- O id vem do navegador (um por janela aberta): toque duplo em "Salvar" não duplica a venda.
-- Só cria tabelas, políticas e uma função de resumo; não altera dados existentes.

begin;

create table public.caixa_vendas (
  id uuid primary key,
  dono_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quantidade integer not null check (quantidade between 1 and 100000),
  valor_unitario numeric(12, 2) not null check (valor_unitario between 0 and 1000000),
  custo_unitario numeric(12, 2) not null check (custo_unitario between 0 and 1000000),
  canal text not null check (canal in ('porta_a_porta', 'whatsapp', 'indicacao', 'outro')),
  pagamento text not null check (pagamento in ('pix', 'dinheiro', 'cartao')),
  status text not null check (status in ('pago', 'pendente')),
  vendida_em timestamptz not null default now()
);
create index caixa_vendas_dono_data on public.caixa_vendas (dono_id, vendida_em desc);

create table public.caixa_compras (
  id uuid primary key,
  dono_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quantidade integer not null check (quantidade between 1 and 100000),
  custo_unitario numeric(12, 2) not null check (custo_unitario between 0 and 1000000),
  comprada_em timestamptz not null default now()
);
create index caixa_compras_dono_data on public.caixa_compras (dono_id, comprada_em desc);

alter table public.caixa_vendas enable row level security;
alter table public.caixa_compras enable row level security;

-- Sem UPDATE: venda errada é excluída e lançada de novo (como na referência).
create policy caixa_vendas_ler on public.caixa_vendas for select to authenticated
  using (dono_id = (select auth.uid()));
create policy caixa_vendas_inserir on public.caixa_vendas for insert to authenticated
  with check (dono_id = (select auth.uid()) and public.speed_tag_acesso_cliente());
create policy caixa_vendas_excluir on public.caixa_vendas for delete to authenticated
  using (dono_id = (select auth.uid()) and public.speed_tag_acesso_cliente());

create policy caixa_compras_ler on public.caixa_compras for select to authenticated
  using (dono_id = (select auth.uid()));
create policy caixa_compras_inserir on public.caixa_compras for insert to authenticated
  with check (dono_id = (select auth.uid()) and public.speed_tag_acesso_cliente());
create policy caixa_compras_excluir on public.caixa_compras for delete to authenticated
  using (dono_id = (select auth.uid()) and public.speed_tag_acesso_cliente());

revoke all on public.caixa_vendas, public.caixa_compras from anon;
grant select, insert, delete on public.caixa_vendas, public.caixa_compras to authenticated;

-- Resumo do período (p_inicio null = tudo) e do estoque, somado no banco.
-- security invoker: as políticas acima limitam ao dono.
create function public.speed_tag_resumo_caixa(p_inicio timestamptz)
returns table (
  faturamento numeric, custos numeric, vendas bigint, unidades bigint, pendente numeric,
  comprado bigint, vendido bigint, custo_compras numeric
)
language sql stable security invoker set search_path = ''
as $$
  with periodo as (
    select coalesce(sum(quantidade * valor_unitario), 0) as faturamento,
           coalesce(sum(quantidade * custo_unitario), 0) as custos,
           count(*) as vendas,
           coalesce(sum(quantidade), 0)::bigint as unidades,
           coalesce(sum(quantidade * valor_unitario) filter (where status = 'pendente'), 0) as pendente
    from public.caixa_vendas
    where dono_id = (select auth.uid()) and (p_inicio is null or vendida_em >= p_inicio)
  ), compras as (
    select coalesce(sum(quantidade), 0)::bigint as comprado, coalesce(sum(quantidade * custo_unitario), 0) as custo_compras
    from public.caixa_compras where dono_id = (select auth.uid())
  ), total_vendido as (
    select coalesce(sum(quantidade), 0)::bigint as vendido from public.caixa_vendas where dono_id = (select auth.uid())
  )
  select p.faturamento, p.custos, p.vendas, p.unidades, p.pendente, c.comprado, v.vendido, c.custo_compras
  from periodo p, compras c, total_vendido v;
$$;

revoke all on function public.speed_tag_resumo_caixa(timestamptz) from public, anon;
grant execute on function public.speed_tag_resumo_caixa(timestamptz) to authenticated;

commit;
