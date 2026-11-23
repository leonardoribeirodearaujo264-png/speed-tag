import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { MensagemErro } from "@/components/auth/campos";
import { Skeleton } from "@/components/ui/skeleton";
import { caminhoInternoSeguro } from "@/lib/auth";
import { FormEntrar } from "./form-entrar";
import { FormCadastro, FormSenha } from "./form-senha";

export const metadata: Metadata = { title: "Entrar" };

async function Conteudo({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const { proximo, erro, cadastro } = await searchParams;
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel/empresas");
  const primeiroAcesso = erro === "link" || destino.startsWith("/ativar/") || destino.startsWith("/painel/empresas?placa=");
  const login = `/entrar?proximo=${encodeURIComponent(destino)}`;
  if (cadastro === "1") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Criar conta de cliente</h2>
        <FormCadastro destino={destino} />
        <Link href={login} className="text-sm font-medium text-marca-texto underline">Já tenho conta</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <FormSenha destino={destino} />
      <Link href={`${login}&cadastro=1`} className="text-sm font-medium text-marca-texto underline">Criar conta</Link>
      <Link href={`/recuperar-senha?proximo=${encodeURIComponent(destino)}`} className="text-sm font-medium text-marca-texto underline">Esqueci minha senha</Link>
      <details open={primeiroAcesso ? true : undefined} className="rounded-xl border p-3">
        <summary className="cursor-pointer font-medium text-marca-texto">Primeiro acesso ou entrar por e-mail</summary>
        <div className="mt-3 space-y-3">
          {erro === "link" && <MensagemErro>O link expirou ou já foi usado. Peça um novo abaixo.</MensagemErro>}
          <FormEntrar proximo={destino} />
        </div>
      </details>
    </div>
  );
}

export default function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  return (
    <LayoutAutenticacao
      titulo="Acesse sua conta"
      subtitulo="Acesse suas empresas e placas com e-mail e senha, ou solicite acesso por e-mail."
    >
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </LayoutAutenticacao>
  );
}
