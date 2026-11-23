"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { BotaoPrincipal, CampoTexto, MensagemErro } from "@/components/auth/campos";

export function FormCodigoEmail({ acao, rotulo }: {
  acao: (anterior: string, dados: FormData) => Promise<string>;
  rotulo: string;
}) {
  const [erro, enviar, pendente] = useActionState(acao, "");
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <CampoTexto id="codigo" rotulo="Código recebido por e-mail" icone={KeyRound} type="text" inputMode="numeric"
        autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required
        className="font-mono tracking-[0.3em]" aria-invalid={!!erro} />
      {erro && <MensagemErro>{erro}</MensagemErro>}
      <BotaoPrincipal carregando={pendente}>{pendente ? "Verificando..." : rotulo}</BotaoPrincipal>
    </form>
  );
}
