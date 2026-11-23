"use client";

import { useActionState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { criarPlacaAcao, type EstadoNovaPlaca } from "./acoes";

type Props = { lotes: Array<{ id: string; nome: string }> };

export function FormNovaPlaca({ lotes }: Props) {
  const [estado, acao, criando] = useActionState<EstadoNovaPlaca, FormData>(criarPlacaAcao, { erro: null });

  return (
    <form action={acao} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="lote">Lote</Label>
        <select
          id="lote"
          name="lote"
          defaultValue=""
          className="h-11 rounded-md border border-input bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="">Sem lote (venda avulsa)</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          O código é gerado automaticamente. A placa nasce aguardando ativação pelo cliente.
        </p>
      </div>

      {estado.erro && (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 text-base" disabled={criando}>
        {criando ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        {criando ? "Criando..." : "Criar placa"}
      </Button>
    </form>
  );
}
