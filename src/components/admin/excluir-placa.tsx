"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { excluirPlacaAcao } from "./acoes-placa";

export function ExcluirPlaca({ placaId, codigo, ativa }: { placaId: string; codigo: string; ativa: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [pendente, iniciar] = useTransition();
  const confere = digitado.trim().toUpperCase() === codigo;

  if (!aberto) {
    return (
      <Button variant="destructive" onClick={() => setAberto(true)}>
        <Trash2 aria-hidden /> Apagar placa
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
      <p className="text-sm text-red-800">
        {ativa
          ? "Esta placa está ativa: depois de apagada, o NFC e o QR Code dela param de funcionar para o cliente. "
          : ""}
        As leituras e o histórico da placa também serão apagados. Isso não tem volta.
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-red-900">
        Digite {codigo} para confirmar
        <input
          value={digitado}
          onChange={(e) => setDigitado(e.target.value)}
          autoComplete="off"
          className="h-10 rounded-lg border border-red-200 bg-white px-3 font-mono tracking-widest uppercase outline-none focus:ring-4 focus:ring-red-500/15"
        />
      </label>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={!confere || pendente}
          onClick={() =>
            iniciar(async () => {
              const resultado = await excluirPlacaAcao(placaId, codigo);
              if (resultado?.erro) toast.error(resultado.erro);
            })
          }
        >
          {pendente && <Loader2 className="animate-spin" aria-hidden />}
          Apagar para sempre
        </Button>
        <Button variant="outline" disabled={pendente} onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
