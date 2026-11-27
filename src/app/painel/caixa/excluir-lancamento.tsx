"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { excluirLancamento } from "./acoes";

/** Lixeira da lista: confirma antes, porque a exclusão não pode ser desfeita. */
export function ExcluirLancamento({ tipo, id, descricao }: { tipo: "venda" | "compra"; id: string; descricao: string }) {
  const [pendente, iniciar] = useTransition();
  function excluir() {
    if (!window.confirm(`Excluir ${tipo === "venda" ? "a venda" : "a compra"} ${descricao}? Não dá para desfazer.`)) return;
    iniciar(async () => {
      const resultado = await excluirLancamento(tipo, id);
      if (resultado.ok) toast.success(resultado.mensagem);
      else toast.error(resultado.mensagem);
    });
  }
  return (
    <button type="button" onClick={excluir} disabled={pendente} aria-label={`Excluir ${tipo} ${descricao}`}
      className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50">
      {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
    </button>
  );
}
