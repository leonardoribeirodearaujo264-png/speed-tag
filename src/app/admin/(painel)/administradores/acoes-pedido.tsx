"use client";

import { useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { aprovarSolicitacao, recusarSolicitacao, type EstadoAdmin } from "./acoes";

function avisar(resultado: EstadoAdmin) {
  if (resultado.tipo === "erro") toast.error(resultado.mensagem);
  if (resultado.tipo === "sucesso") toast.success(resultado.mensagem);
}

export function AcoesPedido({ usuarioId, email }: { usuarioId: string; email: string }) {
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" disabled={pendente} onClick={() => iniciar(async () => avisar(await aprovarSolicitacao(email)))}>
        {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        Aprovar
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pendente}
        onClick={() => iniciar(async () => avisar(await recusarSolicitacao(usuarioId, email)))}
      >
        <X aria-hidden />
        Recusar
      </Button>
    </div>
  );
}
