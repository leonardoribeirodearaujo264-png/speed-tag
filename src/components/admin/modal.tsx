"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Janela de diálogo acessível: fecha com Esc ou clique fora, foco inicial no conteúdo. */
export function Modal({ titulo, descricao, aberto, aoFechar, children }: {
  titulo: string;
  descricao?: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", tecla);
    caixa.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    // Celular: folha que sobe da base, com altura limitada e rolagem interna. Do sm em diante: janela central.
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm animate-in fade-in sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top)))] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-2xl sm:p-6 sm:zoom-in-95 sm:slide-in-from-bottom-0"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{titulo}</h2>
            {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
          </div>
          <button type="button" onClick={aoFechar} className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:-mt-1 sm:-mr-1 sm:size-9" aria-label="Fechar">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
