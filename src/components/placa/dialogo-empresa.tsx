"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { KeyRound, Link2, Nfc, Pencil, Plus, Trash2, Unlink, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const icones = { criar: Plus, editar: Pencil, placa: Nfc, senha: KeyRound, remover: Unlink, destino: Link2, excluir: Trash2 };

/**
 * Botão que abre uma janela de diálogo. No celular vira painel inferior com altura máxima e
 * rolagem interna (cabeçalho fixo e área segura do iPhone); a partir de 640 px, janela central.
 * Aceita uso controlado (`aberto` + `aoMudar`) quando quem chama precisa fechar após uma ação.
 */
export function DialogoEmpresa({
  tipo, botao, titulo, descricao, children, abertoInicial = false, aberto, aoMudar, classeBotao, semGatilho = false,
}: {
  tipo: keyof typeof icones;
  botao: string;
  titulo?: string;
  descricao?: string;
  children: ReactNode;
  abertoInicial?: boolean;
  aberto?: boolean;
  aoMudar?: (aberto: boolean) => void;
  classeBotao?: string;
  semGatilho?: boolean;
}) {
  const Icone = icones[tipo];
  return (
    <Dialog.Root defaultOpen={abertoInicial} open={aberto} onOpenChange={aoMudar ? (valor) => aoMudar(valor) : undefined}>
      {!semGatilho && <Dialog.Trigger className={buttonVariants({
        variant: tipo === "criar" ? "default" : tipo === "excluir" ? "destructive" : "outline",
        className: classeBotao ?? "min-h-11 w-full justify-center px-4 sm:w-auto",
      })}>
        <Icone aria-hidden /> {botao}
      </Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-slate-950/55 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(85dvh,48rem)] sm:w-[calc(100%_-_3rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 pt-3 pb-4 sm:px-6 sm:pt-6">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tipo === "excluir" ? "bg-red-50 text-red-700" : "bg-marca-claro text-marca-texto"}`}>
              <Icone className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="break-words text-lg font-semibold text-slate-900">{titulo ?? botao}</Dialog.Title>
              {descricao && <Dialog.Description className="mt-0.5 text-sm text-slate-600">{descricao}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Fechar" className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-marca">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="pb-seguro min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 sm:px-6 sm:pb-6">
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
