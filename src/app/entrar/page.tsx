import { Suspense } from "react";
import type { Metadata } from "next";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { MensagemErro } from "@/components/auth/campos";
import { Skeleton } from "@/components/ui/skeleton";
import { caminhoInternoSeguro } from "@/lib/auth";
import { FormEntrar } from "./form-entrar";

export const metadata: Metadata = { title: "Entrar" };

async function Conteudo({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const { proximo, erro } = await searchParams;
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel");
  return (
    <div className="flex flex-col gap-5">
      {erro === "link" && <MensagemErro>O link expirou ou já foi usado. Peça um novo abaixo.</MensagemErro>}
      <FormEntrar proximo={destino} />
    </div>
  );
}

export default function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  return (
    <LayoutAutenticacao
      titulo="Acesse sua conta"
      subtitulo="Acompanhe as leituras das suas placas. Enviamos um link de acesso para o seu e-mail, sem senha."
    >
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </LayoutAutenticacao>
  );
}
