import { redirect } from "next/navigation";
import { ErroCaixa, TelaCaixa, carregarCaixa } from "@/components/caixa/tela-caixa";
import { periodoValido } from "@/lib/caixa/regras";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { PaginaCliente } from "../menu-cliente";

export const instant = false;
export const metadata = { title: "Caixa" };

export default async function Caixa({ searchParams }: PageProps<"/painel/caixa">) {
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?proximo=/painel/caixa");

  const periodo = periodoValido((await searchParams).periodo);
  const [acesso, dados] = await Promise.all([supabase.rpc("speed_tag_acesso_cliente"), carregarCaixa(supabase, user.id, periodo)]);
  if (acesso.error || !acesso.data) return <PaginaCliente><p role="alert">Seu acesso está indisponível.</p></PaginaCliente>;

  return (
    <PaginaCliente>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Caixa</h1>
      {dados ? <TelaCaixa dados={dados} periodo={periodo} caminho="/painel/caixa" tema="escuro" /> : <ErroCaixa tema="escuro" />}
    </PaginaCliente>
  );
}
