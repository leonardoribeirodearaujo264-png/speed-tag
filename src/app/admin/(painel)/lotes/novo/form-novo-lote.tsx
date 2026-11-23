"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarLoteAcao, type EstadoNovoLote } from "./acoes";

export function FormNovoLote() {
  const [estado, acao, criando] = useActionState<EstadoNovoLote, FormData>(criarLoteAcao, { erro: null });

  return (
    <form action={acao} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome do lote</Label>
        <Input id="nome" name="nome" required maxLength={120} placeholder="Ex.: Gráfica nov/2026" className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="quantidade">Quantidade de placas</Label>
        <Input
          id="quantidade"
          name="quantidade"
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={10000}
          defaultValue={50}
          className="h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="revendedor">
          Revendedor <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="revendedor" name="revendedor" maxLength={120} className="h-11 text-base" />
      </div>

      {estado.erro && (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 text-base" disabled={criando}>
        {criando && <Loader2 className="animate-spin" aria-hidden />}
        {criando ? "Gerando códigos..." : "Criar lote"}
      </Button>
    </form>
  );
}
