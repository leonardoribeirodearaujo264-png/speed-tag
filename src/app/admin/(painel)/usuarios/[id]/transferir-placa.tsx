"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { transferirPlaca } from "./acoes";

export function TransferirPlaca({ usuarioId }: { usuarioId: string }) {
  const [resultado, acao, pendente] = useActionState(transferirPlaca.bind(null, usuarioId), "");
  return (
    <form action={acao} className="space-y-3 px-4 py-5 sm:px-6">
      <label className="block space-y-2 text-sm">
        <span>Código da placa a atribuir ou transferir</span>
        <Input name="codigo" maxLength={12} required className="h-11" />
      </label>
      <p className="text-sm text-muted-foreground">A placa fica disponível no painel do novo titular. O endereço gravado na tag continua válido.</p>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="confirmar" required className="size-4 accent-marca" /> Confirmo a atribuição ou transferência</label>
      <Button type="submit" disabled={pendente}>{pendente ? "Transferindo..." : "Atribuir ou transferir placa"}</Button>
      {resultado && <p role="status" className="text-sm">{resultado}</p>}
    </form>
  );
}
