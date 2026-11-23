import { Suspense } from "react";
import Link from "next/link";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { caminhoInternoSeguro } from "@/lib/auth";
import { FormRecuperacao } from "./form-recuperacao";

export const metadata = { title: "Recuperar senha", robots: { index: false } };

async function Conteudo({ searchParams }: { searchParams: PageProps<"/recuperar-senha">["searchParams"] }) {
  const { erro, proximo } = await searchParams;
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel/empresas");
  return (
    <div className="space-y-4">
      {erro === "link" && <p role="alert" className="text-sm text-destructive">O link expirou ou já foi usado. Solicite outro abaixo.</p>}
      <FormRecuperacao destino={destino} />
      <Link href={`/entrar?proximo=${encodeURIComponent(destino)}`} className="inline-block text-sm font-medium text-marca-texto underline">Voltar para entrar</Link>
    </div>
  );
}

export default function RecuperarSenha({ searchParams }: PageProps<"/recuperar-senha">) {
  return <LayoutAutenticacao titulo="Recuperar senha" subtitulo="Receba um código ou link para definir uma nova senha.">
    <Suspense fallback={<p>Carregando...</p>}><Conteudo searchParams={searchParams} /></Suspense>
  </LayoutAutenticacao>;
}
