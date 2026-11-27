"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Wallet } from "lucide-react";

const ABAS = [
  { href: "/painel/empresas", rotulo: "Empresas", Icone: Building2 },
  { href: "/painel/caixa", rotulo: "Caixa", Icone: Wallet },
] as const;

/** Abas do painel do cliente, logo abaixo do cabeçalho. */
export function AbasCliente() {
  const caminho = usePathname();
  return (
    <nav aria-label="Seções do painel" className="mx-auto flex w-full max-w-3xl gap-1 px-4 pb-2 sm:px-6">
      {ABAS.map(({ href, rotulo, Icone }) => {
        const ativa = caminho === href || caminho.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={ativa ? "page" : undefined}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 sm:flex-none ${
              ativa ? "bg-white text-[#102d66]" : "text-blue-100 hover:bg-white/10"
            }`}>
            <Icone className="size-4" aria-hidden /> {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
