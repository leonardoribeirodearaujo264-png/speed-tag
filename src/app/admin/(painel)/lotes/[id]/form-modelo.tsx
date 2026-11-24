"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SeletorModeloArte } from "@/components/admin/seletor-modelo-arte";
import { MODELOS_ARTE, NOMES_MODELOS, type ModeloArte } from "@/lib/placas/modelos-arte";
import { trocarModeloLoteAcao } from "./acoes";

export function FormModeloLote({ loteId, atual, cores }: { loteId: string; atual: ModeloArte; cores: Record<ModeloArte, number> }) {
  const [modelo, setModelo] = useState(atual);
  const misto = NOMES_MODELOS.filter((m) => cores[m] > 0).length > 1;
  const resumo = NOMES_MODELOS.filter((m) => cores[m] > 0)
    .map((m) => `${cores[m].toLocaleString("pt-BR")} ${MODELOS_ARTE[m].rotulo.toLowerCase()}${cores[m] === 1 ? "" : "s"}`).join(" · ");
  const [salvando, iniciar] = useTransition();

  function trocar(novo: ModeloArte) {
    if (novo === modelo && !misto) return;
    if (misto && !window.confirm(`Este lote tem placas das duas cores (${resumo}). Deixar todas na arte ${MODELOS_ARTE[novo].rotulo}?`)) return;
    const anterior = modelo;
    setModelo(novo);
    iniciar(async () => {
      const r = await trocarModeloLoteAcao(loteId, novo);
      if (r.ok) toast.success(r.mensagem);
      else {
        setModelo(anterior);
        toast.error(r.mensagem);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <SeletorModeloArte nome={`modelo-${loteId}`} valor={misto && !salvando ? null : modelo} aoMudar={trocar} desabilitado={salvando} />
      <p className="flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
        {salvando && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {salvando ? "Salvando..." : misto ? `Lote com cores misturadas: ${resumo}. Escolher uma arte aqui deixa todas iguais.` : `Todas as placas do lote usam esta arte${resumo ? ` (${resumo})` : ""}.`}
      </p>
    </div>
  );
}
