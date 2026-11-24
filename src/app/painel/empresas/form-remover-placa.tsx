"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removerPlacaDaEmpresa, type EstadoRemoverPlaca } from "./acoes";

const INICIAL: EstadoRemoverPlaca = { ok: false, mensagem: "" };

/**
 * Confirmação para tirar a empresa da placa. Depois da remoção a placa fica sem destino:
 * se estava ativa, volta para "Aguardando ativação" com o mesmo cliente, e o NFC e o QR Code
 * passam a abrir a tela de ativação em vez da avaliação.
 */
export function FormRemoverPlaca({ empresa, codigo, nomeEmpresa }: { empresa: string; codigo: string; nomeEmpresa?: string }) {
  const [estado, acao, pendente] = useActionState(removerPlacaDaEmpresa.bind(null, empresa, codigo), INICIAL);

  // O sucesso tira a empresa da tela e fecha o diálogo; o aviso vai para o toast.
  useEffect(() => {
    if (estado.ok) toast.success(estado.mensagem);
  }, [estado]);

  return (
    <form action={acao} className="space-y-3">
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>O NFC e o QR Code da placa {codigo} param de abrir a avaliação{nomeEmpresa ? ` de ${nomeEmpresa}` : " desta empresa"}.</li>
        <li>Se estava ativa, a placa volta para Aguardando ativação e continua com o mesmo cliente.</li>
        <li>Quem ler a placa vê a tela de ativação até ela ser vinculada a outra empresa.</li>
      </ul>
      <label className="flex min-h-11 items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <input name="confirmar" type="checkbox" className="mt-0.5 size-5 shrink-0" required />
        Confirmo que a placa deve parar de abrir a avaliação desta empresa.
      </label>
      <Button type="submit" variant="destructive" className="min-h-11 w-full" disabled={pendente}>
        {pendente ? "Removendo..." : "Remover empresa"}
      </Button>
      {estado.mensagem && !estado.ok && <p role="alert" className="text-sm text-red-700">{estado.mensagem}</p>}
    </form>
  );
}
