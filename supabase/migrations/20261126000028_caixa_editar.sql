-- Caixa: permite editar vendas e compras (antes só inserir e excluir).
-- O dono continua o mesmo: o WITH CHECK impede passar o lançamento para outra conta.

begin;

create policy caixa_vendas_editar on public.caixa_vendas for update to authenticated
  using (dono_id = (select auth.uid()) and public.speed_tag_acesso_cliente())
  with check (dono_id = (select auth.uid()) and public.speed_tag_acesso_cliente());

create policy caixa_compras_editar on public.caixa_compras for update to authenticated
  using (dono_id = (select auth.uid()) and public.speed_tag_acesso_cliente())
  with check (dono_id = (select auth.uid()) and public.speed_tag_acesso_cliente());

-- Só as colunas do formulário; id, dono e data não mudam.
grant update (quantidade, valor_unitario, custo_unitario, canal, pagamento, status) on public.caixa_vendas to authenticated;
grant update (quantidade, custo_unitario) on public.caixa_compras to authenticated;

commit;
