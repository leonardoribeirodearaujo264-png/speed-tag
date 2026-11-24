"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODELOS_ARTE, NOMES_MODELOS, type ModeloArte } from "@/lib/placas/modelos-arte";
import { criarLoteAcao, type EstadoNovoLote } from "./acoes";

/** Quantidade por cor: um lote pode ter placas azuis e pretas (ex.: 50 de cada). */
export function FormNovoLote() {
  const [estado, acao, criando] = useActionState<EstadoNovoLote, FormData>(criarLoteAcao, { erro: null });
  const [quantidades, setQuantidades] = useState<Record<ModeloArte, string>>({ azul: "50", preta: "0" });
  const total = NOMES_MODELOS.reduce((soma, m) => soma + (Number.parseInt(quantidades[m], 10) || 0), 0);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome do lote</Label>
        <Input id="nome" name="nome" required maxLength={120} placeholder="Ex.: Gráfica nov/2026" className="h-11 text-base" />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Quantidade de placas por cor</legend>
        <div className="grid grid-cols-2 gap-3">
          {NOMES_MODELOS.map((modelo) => (
            <label key={modelo} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200 p-2 focus-within:border-marca focus-within:ring-4 focus-within:ring-marca/15">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura da arte estática */}
              <img src={MODELOS_ARTE[modelo].arquivo} alt="" width={160} height={160} loading="lazy" className="aspect-square h-auto w-full rounded-xl object-cover" />
              <span className="text-center text-sm font-medium text-slate-700">{MODELOS_ARTE[modelo].rotulo}</span>
              <Input
                name={`quantidade_${modelo}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={10000}
                value={quantidades[modelo]}
                onChange={(e) => setQuantidades((q) => ({ ...q, [modelo]: e.target.value }))}
                aria-label={`Quantidade de placas ${MODELOS_ARTE[modelo].rotulo.toLowerCase()}`}
                className="h-11 text-center text-base"
              />
            </label>
          ))}
        </div>
        <p className="text-sm text-slate-600" aria-live="polite">
          Total: <strong className="text-slate-900">{total.toLocaleString("pt-BR")}</strong> {total === 1 ? "placa" : "placas"}. Cada placa sai com a
          arte da sua cor na prévia, no PNG, na folha de impressão e no PDF.
        </p>
      </fieldset>

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

      <Button type="submit" className="h-11 text-base" disabled={criando || total < 1}>
        {criando && <Loader2 className="animate-spin" aria-hidden />}
        {criando ? "Gerando códigos..." : `Criar lote com ${total.toLocaleString("pt-BR")} ${total === 1 ? "placa" : "placas"}`}
      </Button>
    </form>
  );
}
