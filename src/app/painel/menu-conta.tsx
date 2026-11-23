"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { LogOut, UserRound } from "lucide-react";

const item = "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-slate-700 outline-none data-highlighted:bg-slate-100 data-highlighted:text-slate-900";

/** Menu da conta no cabeçalho: fecha com Esc, toque fora e ao escolher uma opção. */
export function MenuConta({ nome }: { nome: string }) {
  const sair = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={sair} action="/auth/sair" method="post" hidden>
        <input type="hidden" name="destino" value="/entrar" />
      </form>
      <Menu.Root modal={false}>
        <Menu.Trigger aria-label="Menu da conta"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-marca-ciano data-popup-open:bg-white/10">
          <UserRound className="size-5" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={6} collisionPadding={12} className="z-40">
            <Menu.Popup className="w-64 max-w-[var(--available-width)] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl outline-none">
              <p className="truncate border-b border-slate-100 px-3 pt-2 pb-2.5 text-sm font-semibold text-slate-900" title={nome}>{nome}</p>
              <Menu.LinkItem render={<Link href="/painel/empresas#perfil" />} closeOnClick className={`${item} mt-1`}>
                <UserRound className="size-4 text-slate-500" aria-hidden /> Meu perfil
              </Menu.LinkItem>
              <Menu.Item className={item} onClick={() => sair.current?.requestSubmit()}>
                <LogOut className="size-4 text-slate-500" aria-hidden /> Sair
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  );
}
