import { Suspense } from "react";
import Link from "next/link";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { caminhoInternoSeguro } from "@/lib/auth";
import { FormRecuperacao } from "./form-recuperacao";
import { MensagemErro } from "@/components/auth/campos";

export const metadata = { title: "Recuperar senha", robots: { index: false } };

async function Conteudo({ searchParams }: { searchParams: PageProps<"/recuperar-senha">["searchParams"] }) {
  const { erro, proximo } = await searchParams;
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel/empresas");
  return (
    <div className="flex flex-col gap-6">
      {erro === "link" && <MensagemErro>O link expirou ou já foi usado. Peça outro abaixo.</MensagemErro>}
      <FormRecuperacao destino={destino} />
      <Link href={`/entrar?proximo=${encodeURIComponent(destino)}`} className="flex min-h-11 items-center justify-center text-sm font-medium text-marca-texto hover:underline">Voltar para o login</Link>
    </div>
  );
}

export default function RecuperarSenha({ searchParams }: PageProps<"/recuperar-senha">) {
  return <LayoutAutenticacao titulo="Recuperar senha" subtitulo="Informe o e-mail da sua conta. Enviaremos um código e um link para criar uma nova senha.">
    <Suspense fallback={<p className="text-sm text-slate-500">Carregando...</p>}><Conteudo searchParams={searchParams} /></Suspense>
  </LayoutAutenticacao>;
}
