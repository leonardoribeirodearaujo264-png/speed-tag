import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { FormNovaSenha } from "@/components/auth/form-nova-senha";
import { Skeleton } from "@/components/ui/skeleton";
import { caminhoInternoSeguro } from "@/lib/auth";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Criar senha", robots: { index: false } };

async function Conteudo({ searchParams }: { searchParams: PageProps<"/criar-senha">["searchParams"] }) {
  const supabase = await clienteSupabaseUsuario();
  const [{ data: { user } }, { proximo }] = await Promise.all([supabase.auth.getUser(), searchParams]);
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel/empresas");
  // Só chega aqui quem acabou de confirmar o e-mail pelo link (sessão criada em /auth/confirmar).
  if (!user) redirect("/entrar?erro=link");
  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl bg-marca-claro px-4 py-3 text-sm text-marca-texto">
        E-mail confirmado: <strong className="break-all">{user.email}</strong>
      </p>
      <FormNovaSenha destino={destino} rotulo="Criar senha e acessar o painel" />
    </div>
  );
}

export default function CriarSenha({ searchParams }: PageProps<"/criar-senha">) {
  return (
    <LayoutAutenticacao titulo="Crie sua senha" subtitulo="Com ela você entra no painel para gerenciar suas placas e empresas.">
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </LayoutAutenticacao>
  );
}
