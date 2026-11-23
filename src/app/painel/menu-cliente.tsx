import { Building2, House, LogOut, Nfc, UserRound } from "lucide-react";
import Link from "next/link";
import { LogoCompleta } from "@/components/marca/marca";

const secoes = [
  { id: "inicio", titulo: "Início", href: "/painel/inicio", Icone: House },
  { id: "empresas", titulo: "Empresas", href: "/painel/empresas", Icone: Building2 },
  { id: "placas", titulo: "Placas", href: "/painel", Icone: Nfc },
] as const;

export function MenuCliente({ nome, secao = "placas" }: { nome: string; secao?: (typeof secoes)[number]["id"] }) {
  return (
    <header className="sticky top-0 z-20 bg-marca-fundo">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 px-4 sm:px-6">
        <Link href="/painel/inicio" aria-label="Speed Tag, início do painel" className="py-2"><LogoCompleta className="h-8" /></Link>
        <details className="relative sm:order-3">
          <summary aria-label="Menu da conta" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            <UserRound className="size-5" aria-hidden />
          </summary>
          <div className="absolute top-full right-0 z-30 w-56 rounded-xl border bg-white p-2 shadow-xl">
            <p className="break-words border-b px-3 py-2 text-sm font-medium">{nome}</p>
            <Link href="/painel/empresas#perfil" className="block rounded-lg px-3 py-2.5 text-sm hover:bg-slate-100">Meu perfil</Link>
            <form action="/auth/sair" method="post">
              <input type="hidden" name="destino" value="/entrar" />
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-100" type="submit"><LogOut className="size-4" aria-hidden /> Sair</button>
            </form>
          </div>
        </details>
        <nav aria-label="Painel do cliente" className="flex w-full gap-1 py-1 sm:w-auto">
          {secoes.map(({ id, titulo, href, Icone }) => (
            <Link key={id} href={href} aria-current={secao === id ? "page" : undefined}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium sm:px-3 ${secao === id ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"}`}>
              <Icone className="size-4 shrink-0" aria-hidden /> {titulo}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
