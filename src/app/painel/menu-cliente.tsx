import type { ReactNode } from "react";
import { Building2, House, Nfc } from "lucide-react";
import Link from "next/link";
import { LogoCompleta } from "@/components/marca/marca";
import { MenuConta } from "./menu-conta";

const secoes = [
  { id: "inicio", titulo: "Início", href: "/painel/inicio", Icone: House },
  { id: "empresas", titulo: "Empresas", href: "/painel/empresas", Icone: Building2 },
  { id: "placas", titulo: "Placas", href: "/painel", Icone: Nfc },
] as const;

type Secao = (typeof secoes)[number]["id"];

/** Mesmas seções em dois formatos: abas no cabeçalho (tablet e desktop) e barra inferior fixa (celular). */
function Navegacao({ secao, formato }: { secao: Secao; formato: "topo" | "inferior" }) {
  const inferior = formato === "inferior";
  return (
    <nav aria-label="Painel do cliente"
      className={inferior
        ? "pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-marca-fundo/95 backdrop-blur sm:hidden print:hidden"
        : "hidden sm:block"}>
      <ul className={inferior ? "mx-auto grid max-w-md grid-cols-3 gap-1 px-2 pt-1.5" : "flex items-center gap-1"}>
        {secoes.map(({ id, titulo, href, Icone }) => {
          const ativa = secao === id;
          return (
            <li key={id}>
              <Link href={href} aria-current={ativa ? "page" : undefined}
                className={inferior
                  ? `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-marca-ciano ${ativa ? "text-white" : "text-slate-400 active:bg-white/10"}`
                  : `flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-marca-ciano ${ativa ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                {inferior ? (
                  <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${ativa ? "bg-marca/30 text-marca-ciano" : ""}`}>
                    <Icone className="size-5" aria-hidden />
                  </span>
                ) : <Icone className="size-4 shrink-0" aria-hidden />}
                {titulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MenuCliente({ nome, secao = "placas" }: { nome: string; secao?: Secao }) {
  return (
    <>
      <header className="pt-seguro sticky top-0 z-20 bg-marca-fundo print:hidden">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/painel/inicio" aria-label="Speed Tag, início do painel" className="shrink-0 rounded-lg focus-visible:ring-2 focus-visible:ring-marca-ciano">
            <LogoCompleta className="h-7 sm:h-8" />
          </Link>
          <div className="flex items-center gap-2">
            <Navegacao secao={secao} formato="topo" />
            <MenuConta nome={nome} />
          </div>
        </div>
      </header>
      <Navegacao secao={secao} formato="inferior" />
    </>
  );
}

/**
 * Estrutura das páginas do cliente: cabeçalho, conteúdo centralizado e folga no rodapé
 * para a barra de navegação fixa do celular (incluindo a área segura do iPhone).
 */
export function PaginaCliente({ nome, secao, children, className = "" }: {
  nome: string;
  secao?: Secao;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-dvh bg-slate-50 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <MenuCliente nome={nome} secao={secao} />
      <main className={`mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8 ${className}`}>{children}</main>
    </div>
  );
}
