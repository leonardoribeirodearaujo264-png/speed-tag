import { Suspense } from "react";
import Link from "next/link";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { Skeleton } from "@/components/ui/skeleton";
import { caminhoInternoSeguro } from "@/lib/auth";
import { FormEntrarAdmin } from "./form-entrar-admin";

export const metadata = { title: "Entrar" };

async function Formulario({ searchParams }: { searchParams: PageProps<"/admin/entrar">["searchParams"] }) {
  const { proximo } = await searchParams;
  return <FormEntrarAdmin proximo={caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/admin/placas")} />;
}

export default function EntrarAdmin({ searchParams }: PageProps<"/admin/entrar">) {
  return (
    <LayoutAutenticacao
      selo="Área administrativa"
      titulo="Bem-vindo de volta"
      subtitulo="Entre para criar placas, gerar QR Codes e gravar o NFC."
      rodape={
        <>
          Já é cliente?{" "}
          <Link href="/entrar" className="font-medium text-marca-texto hover:text-marca-texto hover:underline">
            Acessar painel do cliente
          </Link>
        </>
      }
    >
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Formulario searchParams={searchParams} />
      </Suspense>
    </LayoutAutenticacao>
  );
}
