"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { classeCampo } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { atribuirDoLoteAcao, type EstadoAtribuirLote } from "./acoes";

export function FormAtribuirLote({ loteId, disponiveis }: { loteId: string; disponiveis: number }) {
  const [estado, acao, enviando] = useActionState<EstadoAtribuirLote, FormData>(atribuirDoLoteAcao, { tipo: "inicial" });
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.tipo === "sucesso") {
      toast.success(estado.mensagem);
      formulario.current?.reset();
    }
    if (estado.tipo === "erro") toast.error(estado.mensagem);
  }, [estado]);

  if (disponiveis === 0) {
    return <p className="text-sm text-slate-500">Nenhuma placa deste lote está em estoque.</p>;
  }

  return (
    <form ref={formulario} action={acao} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <input type="hidden" name="loteId" value={loteId} />
      <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
        E-mail do cliente
        <input name="email" type="email" required inputMode="email" placeholder="cliente@empresa.com" className={classeCampo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 sm:w-32">
        Quantidade
        <input name="quantidade" type="number" required min={1} max={Math.min(disponiveis, 1000)} defaultValue={1} className={classeCampo} />
      </label>
      <Button type="submit" size="lg" className="h-11 px-5" disabled={enviando}>
        {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
        Atribuir
      </Button>
    </form>
  );
}
