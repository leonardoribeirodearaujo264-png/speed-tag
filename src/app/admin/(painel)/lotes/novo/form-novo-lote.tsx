"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeletorModeloArte } from "@/components/admin/seletor-modelo-arte";
import { MODELO_PADRAO, type ModeloArte } from "@/lib/placas/modelos-arte";
import { criarLoteAcao, type EstadoNovoLote } from "./acoes";

export function FormNovoLote() {
  const [estado, acao, criando] = useActionState<EstadoNovoLote, FormData>(criarLoteAcao, { erro: null });
  const [modelo, setModelo] = useState<ModeloArte>(MODELO_PADRAO);

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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Arte das placas</legend>
        <SeletorModeloArte valor={modelo} aoMudar={setModelo} desabilitado={criando} />
        <p className="text-xs text-muted-foreground">Usada na prévia, no PNG e na folha de impressão. Dá para trocar depois.</p>
      </fieldset>

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
