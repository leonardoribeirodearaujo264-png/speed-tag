"use client";

import { Suspense, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Building2, LayoutDashboard, Menu, Nfc, Tags, UserCheck, Users, Wallet, X } from "lucide-react";
import { cn } from "cn";
import { LogoCompleta } from "@/components/marca/marca";
import { ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";

const ITENS = [
  { href: "/admin", rotulo: "Início", icone: LayoutDashboard, exato: true },
  { href: "/admin/empresas", rotulo: "Empresas", icone: Building2, exato: false },
  { href: "/admin/placas", rotulo: "Placas", icone: Tags, exato: false },
  { href: ROTA_PREPARO_NFC, rotulo: "Preparar NFC", icone: Nfc, exato: false },
  { href: "/admin/lotes", rotulo: "Lotes", icone: Boxes, exato: false },
  { href: "/admin/caixa", rotulo: "Caixa", icone: Wallet, exato: false },
  { href: "/admin/usuarios", rotulo: "Gestão de Clientes", icone: Users, exato: false },
  { href: "/admin/cadastros", rotulo: "Cadastros", icone: UserCheck, exato: false },
] as const;

const classeBotaoIcone =
  "grid size-11 shrink-0 place-items-center rounded-xl text-slate-300 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-marca-ciano";

function ativo(caminho: string | null, href: string, exato: boolean) {
  if (caminho === null) return false;
  return exato ? caminho === href : caminho === href || caminho.startsWith(`${href}/`);
}

type PropsLinks = { aoNavegar?: () => void };

function Links({ caminho, aoNavegar }: PropsLinks & { caminho: string | null }) {
  return (
    <nav aria-label="Administração" className="flex flex-col gap-1">
      {ITENS.map(({ href, rotulo, icone: Icone, exato }) => {
        const atual = ativo(caminho, href, exato);
        return (
          <Link
            key={href}
            href={href}
            onClick={aoNavegar}
            aria-current={atual ? "page" : undefined}
            className={cn(
              "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-marca-ciano",
              atual ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {atual && (
              <span aria-hidden className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-gradient-to-b from-marca-ciano to-marca" />
            )}
            <Icone className={cn("size-[18px] shrink-0", atual ? "text-marca-ciano" : "text-slate-500 group-hover:text-slate-300")} aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

function LinksComCaminho(props: PropsLinks) {
  return <Links caminho={usePathname()} {...props} />;
}

/** O caminho atual só existe em tempo de execução; o prerender mostra os links sem destaque. */
export function NavAdmin(props: PropsLinks) {
  return (
    <Suspense fallback={<Links caminho={null} {...props} />}>
      <LinksComCaminho {...props} />
    </Suspense>
  );
}

/**
 * Menu do celular e do tablet: botão de 44 px que abre uma gaveta lateral com os mesmos itens.
 * Usa <dialog> modal: foco preso na gaveta, Esc fecha e o foco volta ao botão que abriu.
 * Fecha também ao tocar no fundo escurecido e ao escolher um item.
 */
export function MenuAdminCelular({ rodape }: { rodape: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const gaveta = useRef<HTMLDialogElement>(null);
  const id = useId();
  const fechar = useCallback(() => setAberto(false), []);

  useEffect(() => {
    const dialogo = gaveta.current;
    if (!dialogo) return;
    if (!aberto) {
      if (dialogo.open) dialogo.close();
      return;
    }
    if (!dialogo.open) dialogo.showModal();
    // Trava a rolagem da página por trás da gaveta.
    const raiz = document.documentElement;
    const anterior = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    // Se a tela passar para desktop com a gaveta aberta, fecha: a barra lateral assume.
    const desktop = window.matchMedia("(min-width: 1024px)");
    const aoMudar = (e: MediaQueryListEvent) => {
      if (e.matches) setAberto(false);
    };
    desktop.addEventListener("change", aoMudar);
    return () => {
      raiz.style.overflow = anterior;
      desktop.removeEventListener("change", aoMudar);
    };
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={id}
        className={cn(classeBotaoIcone, "-ml-2")}
      >
        <Menu className="size-6" aria-hidden />
      </button>

      <dialog
        ref={gaveta}
        id={id}
        aria-label="Menu do painel"
        onClose={fechar}
        // Clique no próprio <dialog>, fora do conteúdo, é o toque no fundo escurecido.
        onClick={(e) => {
          if (e.target === e.currentTarget) fechar();
        }}
        className="fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-none w-[min(20rem,86vw)] max-w-none overflow-hidden bg-marca-fundo p-0 text-white shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm open:animate-in open:duration-200 open:slide-in-from-left motion-reduce:animate-none lg:hidden"
      >
        <div className="pt-seguro pb-seguro relative flex h-full flex-col pl-[env(safe-area-inset-left)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(23,103,255,0.22),transparent_60%)]"
          />
          <div className="relative flex items-center justify-between gap-3 py-4 pr-3 pl-5">
            <Link href="/admin" onClick={fechar} aria-label="Speed Tag, início do painel" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-marca-ciano">
              <LogoCompleta className="h-9" />
            </Link>
            <button type="button" onClick={fechar} aria-label="Fechar menu" className={classeBotaoIcone}>
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-2">
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Painel</p>
            <NavAdmin aoNavegar={fechar} />
          </div>
          <div className="relative px-3 pt-3">{rodape}</div>
        </div>
      </dialog>
    </>
  );
}
