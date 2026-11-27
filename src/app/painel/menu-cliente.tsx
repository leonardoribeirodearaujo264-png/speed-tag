import type { ReactNode } from "react";
import Link from "next/link";
import { LogoCompleta } from "@/components/marca/marca";
import { AbasCliente } from "./abas-cliente";
import { MenuConta } from "./menu-conta";

export function PaginaCliente({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-marca-fundo text-white">
      <header className="pt-seguro sticky top-0 z-20 border-b border-blue-400/25 bg-[#102d66]">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/painel/empresas" aria-label="Speed Tag, minhas empresas" className="rounded-lg focus-visible:ring-2 focus-visible:ring-cyan-300">
            <LogoCompleta className="h-8" />
          </Link>
          <MenuConta />
        </div>
        <AbasCliente />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">{children}</main>
    </div>
  );
}
