"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removerAdmin } from "./acoes";

export function BotaoRemover({ email }: { email: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();

  if (!confirmando) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirmando(true)}>
        Remover acesso
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="destructive"
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const resultado = await removerAdmin(email);
            if (resultado.tipo === "erro") toast.error(resultado.mensagem);
            else if (resultado.tipo === "sucesso") toast.success(resultado.mensagem);
            setConfirmando(false);
          })
        }
      >
        {pendente && <Loader2 className="animate-spin" aria-hidden />}
        Confirmar
      </Button>
      <Button variant="outline" size="sm" disabled={pendente} onClick={() => setConfirmando(false)}>
        Cancelar
      </Button>
    </div>
  );
}
