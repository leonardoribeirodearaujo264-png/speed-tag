"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { KeyRound, Nfc, Pencil, Plus, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const icones = { criar: Plus, editar: Pencil, placa: Nfc, senha: KeyRound };

export function DialogoEmpresa({
  tipo, botao, titulo, descricao, children, abertoInicial = false,
}: {
  tipo: keyof typeof icones;
  botao: string;
  titulo?: string;
  descricao?: string;
  children: ReactNode;
  abertoInicial?: boolean;
}) {
  const Icone = icones[tipo];
  return (
    <Dialog.Root defaultOpen={abertoInicial}>
      <Dialog.Trigger className={buttonVariants({
        variant: tipo === "criar" ? "default" : "outline",
        className: "min-h-11 w-full justify-center px-4 sm:w-auto",
      })}>
        <Icone aria-hidden /> {botao}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-slate-950/55" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-claro text-marca-texto">
              <Icone className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="break-words text-lg font-semibold text-slate-900">{titulo ?? botao}</Dialog.Title>
              {descricao && <Dialog.Description className="mt-0.5 text-sm text-slate-600">{descricao}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Fechar" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-marca">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
