import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { Skeleton } from "@/components/ui/skeleton";
import { caminhoInternoSeguro } from "@/lib/auth";
import { FormCadastro } from "../entrar/form-senha";

export const metadata: Metadata = { title: "Criar conta" };

async function Conteudo({ searchParams }: { searchParams: PageProps<"/cadastro">["searchParams"] }) {
  const { proximo } = await searchParams;
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel/empresas");
  return (
    <div className="flex flex-col gap-6">
      <FormCadastro destino={destino} />
      <p className="text-center text-sm text-slate-500">
        Já tem uma conta?{" "}
        <Link href={`/entrar?proximo=${encodeURIComponent(destino)}`} className="font-semibold text-marca-texto hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

export default function PaginaCadastro({ searchParams }: PageProps<"/cadastro">) {
  return (
    <LayoutAutenticacao titulo="Crie sua conta" subtitulo="Gerencie suas placas Speed Tag e acompanhe as avaliações da sua empresa.">
      <Suspense fallback={<Skeleton className="h-[34rem] w-full rounded-xl" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </LayoutAutenticacao>
  );
}
