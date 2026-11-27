import { CabecalhoPagina } from "@/components/admin/ui";
import { ErroCaixa, TelaCaixa, carregarCaixa } from "@/components/caixa/tela-caixa";
import { exigirAdmin } from "@/lib/auth";
import { periodoValido } from "@/lib/caixa/regras";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Caixa" };

/** Caixa da própria conta do ADM: vendas, compras e estoque de placas. */
export default async function CaixaAdmin({ searchParams }: PageProps<"/admin/caixa">) {
  const { supabase, usuarioId } = await exigirAdmin("/admin/caixa");
  const periodo = periodoValido((await searchParams).periodo);
  const dados = await carregarCaixa(supabase, usuarioId, periodo);

  return (
    <div>
      <CabecalhoPagina titulo="Caixa" descricao="Controle das suas vendas, compras e estoque de placas." />
      {dados ? <TelaCaixa dados={dados} periodo={periodo} caminho="/admin/caixa" tema="claro" /> : <ErroCaixa tema="claro" />}
    </div>
  );
}
