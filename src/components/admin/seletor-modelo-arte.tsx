"use client";

import { MODELOS_ARTE, NOMES_MODELOS, type ModeloArte } from "@/lib/placas/modelos-arte";

/** Escolha visual do modelo de arte (miniatura de cada um), como grupo de rádio. */
export function SeletorModeloArte({ nome = "modelo_arte", valor, aoMudar, desabilitado }: {
  nome?: string;
  valor: ModeloArte;
  aoMudar: (modelo: ModeloArte) => void;
  desabilitado?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Modelo da arte" className="grid grid-cols-2 gap-3">
      {NOMES_MODELOS.map((modelo) => {
        const ativo = modelo === valor;
        return (
          <label
            key={modelo}
            className={`group relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-2xl border-2 p-2 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-marca/20 ${
              ativo ? "border-marca bg-marca-claro/50" : "border-slate-200 hover:border-slate-300"
            } ${desabilitado ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={nome}
              value={modelo}
              checked={ativo}
              disabled={desabilitado}
              onChange={() => aoMudar(modelo)}
              className="sr-only"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura da arte estática */}
            <img src={MODELOS_ARTE[modelo].arquivo} alt="" width={160} height={160} loading="lazy" className="aspect-square h-auto w-full rounded-xl object-cover" />
            <span className={`text-center text-sm font-medium ${ativo ? "text-marca-texto" : "text-slate-700"}`}>
              {MODELOS_ARTE[modelo].rotulo}
            </span>
          </label>
        );
      })}
    </div>
  );
}
