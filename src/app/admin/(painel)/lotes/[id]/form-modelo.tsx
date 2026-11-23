"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SeletorModeloArte } from "@/components/admin/seletor-modelo-arte";
import type { ModeloArte } from "@/lib/placas/modelos-arte";
import { trocarModeloLoteAcao } from "./acoes";

export function FormModeloLote({ loteId, atual }: { loteId: string; atual: ModeloArte }) {
  const [modelo, setModelo] = useState(atual);
  const [salvando, iniciar] = useTransition();

  function trocar(novo: ModeloArte) {
    if (novo === modelo) return;
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
      <SeletorModeloArte nome={`modelo-${loteId}`} valor={modelo} aoMudar={trocar} desabilitado={salvando} />
      <p className="flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
        {salvando && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {salvando ? "Salvando..." : "Todas as placas do lote usam esta arte."}
      </p>
    </div>
  );
}
