import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { Skeleton } from "@/components/ui/skeleton";
import { caminhoInternoSeguro } from "@/lib/auth";
import { FormSenha } from "./form-senha";

export const metadata: Metadata = { title: "Entrar" };

const ERROS: Record<string, string> = {
  link: "O link do e-mail expirou ou já foi usado. Entre com sua senha ou peça um novo link.",
};

async function Conteudo({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const { proximo, erro } = await searchParams;
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel/empresas");
  const sufixo = destino === "/painel/empresas" ? "" : `?proximo=${encodeURIComponent(destino)}`;
  return (
    <div className="flex flex-col gap-6">
      <FormSenha destino={destino} erroInicial={typeof erro === "string" ? ERROS[erro] : undefined} />
      <div className="flex items-center gap-3 text-xs text-slate-400" aria-hidden>
        <span className="h-px flex-1 bg-slate-200" /> ou <span className="h-px flex-1 bg-slate-200" />
      </div>
      <Link
        href={`/entrar/codigo${sufixo}`}
        className="flex h-12 items-center justify-center rounded-xl border border-slate-200 text-[15px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-marca/20 focus-visible:outline-none"
      >
        Entrar com código por e-mail
      </Link>
      <p className="text-center text-sm text-slate-500">
        Ainda não tem uma conta?{" "}
        <Link href={`/cadastro${sufixo}`} className="font-semibold text-marca-texto hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}

export default function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  return (
    <LayoutAutenticacao titulo="Bem-vindo de volta" subtitulo="Entre para gerenciar suas placas e empresas.">
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </LayoutAutenticacao>
  );
}
