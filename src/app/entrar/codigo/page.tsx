import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { Skeleton } from "@/components/ui/skeleton";
import { caminhoInternoSeguro } from "@/lib/auth";
import { FormEntrar } from "../form-entrar";

export const metadata: Metadata = { title: "Entrar com código", robots: { index: false } };

async function Conteudo({ searchParams }: { searchParams: PageProps<"/entrar/codigo">["searchParams"] }) {
  const { proximo } = await searchParams;
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel/empresas");
  return (
    <div className="flex flex-col gap-6">
      <FormEntrar proximo={destino} />
      <Link href={`/entrar?proximo=${encodeURIComponent(destino)}`} className="flex min-h-11 items-center justify-center text-sm font-medium text-marca-texto hover:underline">
        Entrar com senha
      </Link>
    </div>
  );
}

export default function EntrarComCodigo({ searchParams }: PageProps<"/entrar/codigo">) {
  return (
    <LayoutAutenticacao titulo="Entrar com código" subtitulo="Enviaremos um código de acesso para o e-mail da sua conta.">
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </LayoutAutenticacao>
  );
}
