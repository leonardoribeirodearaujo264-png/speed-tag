"use client";

import { useActionState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { BotaoPrincipal, CampoTexto, MensagemErro } from "@/components/auth/campos";
import { enviarLinkMagico, type EstadoEntrar } from "./acoes";

export function FormEntrar({ proximo }: { proximo: string }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(enviarLinkMagico, {
    tipo: "inicial",
  });

  if (estado.tipo === "enviado") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-8 text-center animate-in fade-in zoom-in-95" role="status">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-marca-claro ring-1 ring-marca-borda">
          <MailCheck className="size-7 text-marca-texto" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold text-slate-900">Link enviado</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Abra o e-mail enviado para <span className="font-medium text-slate-700">{estado.email}</span> neste aparelho e
            toque no link. Ele vale por 1 hora.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="proximo" value={proximo} />
      <CampoTexto
        id="email"
        rotulo="E-mail"
        icone={Mail}
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="voce@empresa.com"
        aria-invalid={estado.tipo === "erro"}
      />
      {estado.tipo === "erro" && <MensagemErro>{estado.mensagem}</MensagemErro>}
      <BotaoPrincipal carregando={enviando}>{enviando ? "Enviando..." : "Receber link de acesso"}</BotaoPrincipal>
    </form>
  );
}
