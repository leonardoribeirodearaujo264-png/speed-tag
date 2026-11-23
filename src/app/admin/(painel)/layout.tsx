import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { LogOut } from "lucide-react";
import { LogoCompleta, SimboloS } from "@/components/marca/marca";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { NavAdmin } from "./nav-admin";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: { template: "%s | Admin", default: "Admin" } };

/** Só exibe quem está logado. A autorização fica em cada página e ação (exigirAdmin). */
async function lerUsuario(): Promise<{ email: string; nome: string | null } | null> {
  // O layout é pré-renderizado com cookies (partialPrefetching); o supabase-js lê Date.now()
  // ao validar a sessão, o que só é permitido depois de connection(). Fica dentro de Suspense.
  await connection();
  try {
    const supabase = await clienteSupabaseUsuario();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
    return { email: user.email, nome: perfil?.nome ?? null };
  } catch {
    // Falha aqui não pode derrubar o layout; a página mostra o próprio erro em error.tsx.
    return null;
  }
}

async function CartaoUsuario() {
  const usuario = await lerUsuario();
  if (!usuario) return null;
  const inicial = (usuario.nome ?? usuario.email).trim().charAt(0).toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marca to-marca-ciano text-sm font-semibold text-white">
        {inicial}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{usuario.nome ?? "Administrador"}</p>
        <p className="truncate text-xs text-slate-400">{usuario.email}</p>
      </div>
    </div>
  );
}

function BotaoSair({ compacto = false }: { compacto?: boolean }) {
  return (
    <form action="/auth/sair" method="post">
      <input type="hidden" name="destino" value="/admin/entrar" />
      <button
        type="submit"
        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        aria-label="Sair"
      >
        <LogOut className="size-4" aria-hidden />
        {!compacto && "Sair"}
      </button>
    </form>
  );
}

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-1 bg-slate-50">
      {/* Menu lateral (computador) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-marca-fundo print:hidden lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(23,103,255,0.22),transparent_60%)]"
        />
        <div className="relative px-5 pt-6 pb-8">
          <Link href="/admin" aria-label="Speed Tag, início do painel">
            <LogoCompleta className="h-10" prioridade />
          </Link>
        </div>
        <div className="relative flex-1 px-3">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Painel</p>
          <NavAdmin variante="lateral" />
        </div>
        <div className="relative m-3 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <Suspense fallback={<div className="h-9" />}>
            <CartaoUsuario />
          </Suspense>
          <BotaoSair compacto />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra do topo (celular e tablet) */}
        <header className="sticky top-0 z-20 bg-marca-fundo print:hidden lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/admin" className="flex items-center gap-2.5" aria-label="Speed Tag, início do painel">
              <SimboloS tamanho={32} className="ring-white/10" />
              <span className="text-sm font-semibold text-white">Painel</span>
            </Link>
            <BotaoSair />
          </div>
          <NavAdmin variante="topo" />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
