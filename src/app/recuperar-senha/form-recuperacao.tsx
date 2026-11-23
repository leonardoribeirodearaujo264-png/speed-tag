"use client";

import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { BotaoPrincipal, CampoTexto, MensagemErro } from "@/components/auth/campos";
import { FormCodigoEmail } from "@/components/auth/form-codigo-email";
import { confirmarCodigoRecuperacao, solicitarRecuperacao } from "./acoes";

function Solicitacao({ destino, reiniciar }: { destino: string; reiniciar: () => void }) {
  const [estado, acao, pendente] = useActionState(solicitarRecuperacao.bind(null, destino), { tipo: "inicial" });
  if (estado.tipo === "enviado") {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="rounded-xl bg-marca-claro px-4 py-3 text-sm leading-relaxed text-marca-texto">
          Se <strong className="break-all">{estado.email}</strong> tiver conta, enviamos um e-mail com um código e um botão para criar a nova senha.
        </p>
        <FormCodigoEmail acao={confirmarCodigoRecuperacao.bind(null, destino, estado.email)} rotulo="Confirmar código" />
        <button type="button" onClick={reiniciar} className="min-h-11 text-sm font-medium text-marca-texto hover:underline">
          Corrigir e-mail ou pedir outro código
        </button>
      </div>
    );
  }
  return (
    <form action={acao} className="flex flex-col gap-5">
      <CampoTexto id="email" rotulo="E-mail da sua conta" icone={Mail} type="email" inputMode="email" autoComplete="email"
        autoCapitalize="none" spellCheck={false} maxLength={254} required placeholder="voce@empresa.com.br" aria-invalid={estado.tipo === "erro"} />
      {estado.tipo === "erro" && <MensagemErro>{estado.mensagem}</MensagemErro>}
      <BotaoPrincipal carregando={pendente}>{pendente ? "Enviando..." : "Enviar instruções"}</BotaoPrincipal>
    </form>
  );
}

export function FormRecuperacao({ destino }: { destino: string }) {
  const [tentativa, setTentativa] = useState(0);
  return <Solicitacao key={tentativa} destino={destino} reiniciar={() => setTentativa((valor) => valor + 1)} />;
}
