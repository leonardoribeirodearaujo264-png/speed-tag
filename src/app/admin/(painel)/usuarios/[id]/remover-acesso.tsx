"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { removerAcessoCliente } from "./acoes";

export function RemoverAcesso({ usuarioId }: { usuarioId: string }) {
  const [resultado, acao, pendente] = useActionState(removerAcessoCliente.bind(null, usuarioId), "");
  return (
    <form action={acao} className="mt-3 space-y-2 border-t pt-3 text-sm">
      <label className="flex items-start gap-2">
        <input className="mt-1" name="confirmar" type="checkbox" required />
        Confirmo a remoção do acesso ao painel.
      </label>
      <Button type="submit" variant="destructive" size="sm" disabled={pendente}>Remover acesso</Button>
      {resultado && <p role="status">{resultado}</p>}
    </form>
  );
}
