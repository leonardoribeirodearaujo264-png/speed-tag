import { Suspense, cache } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { LogOut } from "lucide-react";
import { LogoCompleta, SimboloS } from "@/components/marca/marca";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { MenuAdminCelular, NavAdmin } from "./nav-admin";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: { template: "%s | Admin", default: "Admin" } };

/**
 * Alvo de toque de 44 px no celular para todo botão do painel (Button e links com buttonVariants,
 * que carregam a classe group/button). No desktop os tamanhos compactos continuam valendo.
 */
const TOQUE_MINIMO_CELULAR = "max-md:[&_[class~='group/button']]:min-h-11";

/**
 * Só exibe quem está logado. A autorização fica em cada página e ação (exigirAdmin).
 * Em cache por requisição: o cartão aparece na barra lateral e na gaveta do celular, com uma consulta só.
 */
const lerUsuario = cache(async (): Promise<{ email: string; nome: string | null } | null> => {
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
});

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
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-400 transition-colors outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-marca-ciano lg:min-h-0 lg:min-w-0"
        aria-label="Sair"
      >
        <LogOut className="size-4" aria-hidden />
        {!compacto && "Sair"}
      </button>
    </form>
  );
}

function RodapeUsuario() {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
      <Suspense fallback={<div className="h-9" />}>
        <CartaoUsuario />
      </Suspense>
      <BotaoSair compacto />
    </div>
  );
}

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return (
    <div className={`flex min-h-dvh w-full min-w-0 flex-1 bg-slate-50 print:block print:min-h-0 print:bg-white ${TOQUE_MINIMO_CELULAR}`}>
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
          <NavAdmin />
        </div>
        <div className="relative m-3">
          <RodapeUsuario />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col print:block">
        {/* Barra do topo (celular e tablet) */}
        <header className="pt-seguro sticky top-0 w-full min-w-0 z-30 bg-marca-fundo/95 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur print:hidden lg:hidden">
          <div className="flex h-14 items-center gap-2 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:h-16">
            <MenuAdminCelular rodape={<RodapeUsuario />} />
            <Link href="/admin" className="flex min-h-11 items-center gap-2.5 rounded-lg" aria-label="Speed Tag, início do painel">
              <SimboloS tamanho={32} className="ring-white/10" />
              <span className="text-sm font-semibold text-white">Painel</span>
            </Link>
            <div className="ml-auto">
              <BotaoSair compacto />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] lg:px-10 lg:py-10 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
