"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { Button } from "@/components/ui/button";
import { avaliarExclusaoLote, descreverExclusaoLote } from "@/lib/placas/exclusao-lote";
import { excluirLoteAcao } from "./acoes";

/** Botão "Excluir lote" com confirmação. Bloqueia quando há placas em uso (a regra é conferida de novo no banco). */
export function ExcluirLote({ loteId, nome, total, emUso, nfcGravado }: {
  loteId: string;
  nome: string;
  total: number;
  emUso: number;
  nfcGravado: number;
}) {
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const situacao = avaliarExclusaoLote({ total, emUso });

  function excluir() {
    setErro("");
    iniciar(async () => {
      // Em caso de sucesso a ação redireciona para a lista de lotes.
      const resultado = await excluirLoteAcao(loteId);
      if (!resultado.ok) setErro(resultado.mensagem);
    });
  }

  return (
    <DialogoEmpresa tipo="excluir" botao="Excluir lote" titulo={`Excluir o lote ${nome}`}
      descricao={`${total.toLocaleString("pt-BR")} ${total === 1 ? "placa" : "placas"} neste lote.`}>
      {situacao.permitido ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-800">
            {descreverExclusaoLote({ total, nfcGravado })}
          </p>
          <label className="flex min-h-11 items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
            Confirmo que quero apagar o lote e as placas dele.
          </label>
          <Button variant="destructive" className="min-h-11 w-full" disabled={!confirmado || pendente} onClick={excluir}>
            {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            {pendente ? "Excluindo..." : "Excluir lote para sempre"}
          </Button>
          {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        </div>
      ) : (
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{situacao.motivo}</p>
        </div>
      )}
    </DialogoEmpresa>
  );
}
