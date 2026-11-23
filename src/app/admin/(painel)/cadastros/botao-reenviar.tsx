"use client";

import { useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reenviarAtivacao } from "./acoes";

export function BotaoReenviar({ usuarioId }: { usuarioId: string }) {
  const [enviando, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 w-full sm:w-auto"
      disabled={enviando}
      onClick={() =>
        iniciar(async () => {
          const r = await reenviarAtivacao(usuarioId);
          if (r.ok) toast.success(r.mensagem);
          else toast.error(r.mensagem);
        })
      }
    >
      {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
      {enviando ? "Enviando..." : "Reenviar e-mail"}
    </Button>
  );
}
