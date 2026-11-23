import type { ReactNode } from "react";
import Link from "next/link";
import { LogoCompleta } from "@/components/marca/marca";

/** Página de texto simples (termos, privacidade) com a marca no topo. */
export function PaginaTexto({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="pt-seguro bg-marca-fundo">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link href="/entrar" aria-label="Speed Tag, ir para o login" className="flex min-h-11 items-center">
            <LogoCompleta className="h-8" />
          </Link>
          <Link href="/entrar" className="flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-slate-300 hover:text-white">Entrar</Link>
        </div>
      </header>
      <main className="pb-seguro mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
        <p className="mt-2 text-sm text-slate-500">Atualizado em {atualizado}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
    </div>
  );
}
