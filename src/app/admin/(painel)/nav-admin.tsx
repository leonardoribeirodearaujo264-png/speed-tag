"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Building2, LayoutDashboard, Nfc, Tags, Users } from "lucide-react";
import { cn } from "cn";
import { ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";

const ITENS = [
  { href: "/admin", rotulo: "Início", icone: LayoutDashboard, exato: true },
  { href: "/admin/empresas", rotulo: "Empresas", icone: Building2, exato: false },
  { href: "/admin/placas", rotulo: "Placas", icone: Tags, exato: false },
  { href: ROTA_PREPARO_NFC, rotulo: "Preparar NFC", icone: Nfc, exato: false },
  { href: "/admin/lotes", rotulo: "Lotes", icone: Boxes, exato: false },
  { href: "/admin/usuarios", rotulo: "Gestão de Clientes", icone: Users, exato: false },
] as const;

type Variante = "lateral" | "topo";

function ativo(caminho: string | null, href: string, exato: boolean) {
  if (caminho === null) return false;
  return exato ? caminho === href : caminho === href || caminho.startsWith(`${href}/`);
}

function Links({ caminho, variante }: { caminho: string | null; variante: Variante }) {
  const lateral = variante === "lateral";
  return (
    <nav aria-label="Administração" className={lateral ? "flex flex-col gap-1" : "flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none]"}>
      {ITENS.map(({ href, rotulo, icone: Icone, exato }) => {
        const atual = ativo(caminho, href, exato);
        return (
          <Link
            key={href}
            href={href}
            aria-current={atual ? "page" : undefined}
            className={cn(
              "group relative flex shrink-0 items-center gap-3 rounded-xl text-sm font-medium transition-colors",
              lateral ? "px-3 py-2.5" : "px-3 py-2",
              atual ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {atual && lateral && (
              <span aria-hidden className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-gradient-to-b from-marca-ciano to-marca" />
            )}
            <Icone className={cn("size-[18px]", atual ? "text-marca-ciano" : "text-slate-500 group-hover:text-slate-300")} aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

function LinksComCaminho({ variante }: { variante: Variante }) {
  return <Links caminho={usePathname()} variante={variante} />;
}

/** O caminho atual só existe em tempo de execução; o prerender mostra os links sem destaque. */
export function NavAdmin({ variante }: { variante: Variante }) {
  return (
    <Suspense fallback={<Links caminho={null} variante={variante} />}>
      <LinksComCaminho variante={variante} />
    </Suspense>
  );
}
