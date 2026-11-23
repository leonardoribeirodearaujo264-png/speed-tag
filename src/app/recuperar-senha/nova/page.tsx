import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { FormNovaSenha } from "@/components/auth/form-nova-senha";
import { caminhoInternoSeguro } from "@/lib/auth";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export const metadata = { title: "Criar nova senha", robots: { index: false } };

async function Conteudo({ searchParams }: { searchParams: PageProps<"/recuperar-senha/nova">["searchParams"] }) {
  const supabase = await clienteSupabaseUsuario();
  const [{ data: { user } }, { proximo }] = await Promise.all([supabase.auth.getUser(), searchParams]);
  const destino = caminhoInternoSeguro(typeof proximo === "string" ? proximo : null, "/painel/empresas");
  if (!user) redirect(`/recuperar-senha?erro=link&proximo=${encodeURIComponent(destino)}`);
  return <FormNovaSenha destino={destino} rotulo="Salvar nova senha" />;
}

export default function NovaSenha({ searchParams }: PageProps<"/recuperar-senha/nova">) {
  return <LayoutAutenticacao titulo="Criar nova senha" subtitulo="Escolha uma senha para voltar à sua conta.">
    <Suspense fallback={<p>Carregando...</p>}><Conteudo searchParams={searchParams} /></Suspense>
  </LayoutAutenticacao>;
}
