"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { removerPlacaDaEmpresa } from "./acoes";

export function FormRemoverPlaca({ empresa, codigo }: { empresa: string; codigo: string }) {
  const [mensagem, acao, pendente] = useActionState(removerPlacaDaEmpresa.bind(null, empresa, codigo), "");
  return (
    <form action={acao} className="space-y-3">
      <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm">
        <input name="confirmar" type="checkbox" className="mt-1" required />
        Confirmo que a placa deve parar de abrir a avaliação desta empresa.
      </label>
      <Button type="submit" variant="destructive" className="min-h-11 w-full" disabled={pendente}>
        {pendente ? "Removendo..." : "Confirmar remoção"}
      </Button>
      {mensagem && <p role="status" className="text-sm">{mensagem}</p>}
    </form>
  );
}
