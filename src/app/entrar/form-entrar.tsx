"use client";

import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { BotaoPrincipal, CampoTexto, MensagemErro } from "@/components/auth/campos";
import { FormCodigoEmail } from "@/components/auth/form-codigo-email";
import { Button } from "@/components/ui/button";
import { entrarComCodigo, enviarLinkMagico, type EstadoEntrar } from "./acoes";

function Solicitacao({ proximo, reiniciar }: { proximo: string; reiniciar: () => void }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(enviarLinkMagico, {
    tipo: "inicial",
  });

  if (estado.tipo === "enviado") {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl bg-marca-claro p-3 text-sm text-marca-texto">
          Confira a caixa de entrada e o spam de <strong className="break-all">{estado.email}</strong>. Se usar o link, abra-o neste mesmo navegador.
        </p>
        <FormCodigoEmail acao={entrarComCodigo.bind(null, proximo, estado.email)} rotulo="Entrar com código" />
        <Button type="button" variant="link" onClick={reiniciar}>Corrigir e-mail ou solicitar outro código</Button>
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
      <BotaoPrincipal carregando={enviando}>{enviando ? "Enviando..." : "Receber e-mail de acesso"}</BotaoPrincipal>
    </form>
  );
}

export function FormEntrar({ proximo }: { proximo: string }) {
  const [tentativa, setTentativa] = useState(0);
  return <Solicitacao key={tentativa} proximo={proximo} reiniciar={() => setTentativa((valor) => valor + 1)} />;
}
