import type { ReactNode } from "react";
import { cn } from "cn";

export function CartaoListagem({
  icone, titulo, subtitulo, opcoes, children, acoes, selecionado,
}: {
  icone: ReactNode;
  titulo: ReactNode;
  subtitulo: ReactNode;
  opcoes: ReactNode;
  children?: ReactNode;
  acoes: ReactNode;
  selecionado?: boolean;
}) {
  return (
    <article className={cn(
      "flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5",
      selecionado && "border-marca/60 bg-marca-claro",
    )}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-marca-fundo text-marca-ciano">
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-semibold text-slate-900">{titulo}</h2>
          <p className="mt-0.5 break-words text-sm text-slate-500">{subtitulo}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">{opcoes}</div>
      </div>
      {children}
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">{acoes}</div>
    </article>
  );
}
