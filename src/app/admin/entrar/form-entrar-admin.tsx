"use client";

import { useActionState } from "react";
import { Lock, Mail } from "lucide-react";
import { BotaoPrincipal, CampoSenha, CampoTexto, MensagemErro } from "@/components/auth/campos";
import { entrarAdmin, type EstadoEntrarAdmin } from "./acoes";

export function FormEntrarAdmin({ proximo }: { proximo: string }) {
  const [estado, acao, entrando] = useActionState<EstadoEntrarAdmin, FormData>(entrarAdmin, {
    erro: null,
    email: "",
  });

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="proximo" value={proximo} />
      <CampoTexto
        id="email"
        rotulo="E-mail"
        icone={Mail}
        type="email"
        inputMode="email"
        autoComplete="username"
        placeholder="voce@empresa.com"
        required
        defaultValue={estado.email}
        aria-invalid={estado.erro !== null}
      />
      <CampoSenha
        id="senha"
        rotulo="Senha"
        icone={Lock}
        autoComplete="current-password"
        placeholder="Sua senha"
        required
        aria-invalid={estado.erro !== null}
      />

      {estado.erro && <MensagemErro>{estado.erro}</MensagemErro>}

      <BotaoPrincipal carregando={entrando}>{entrando ? "Entrando..." : "Entrar"}</BotaoPrincipal>
    </form>
  );
}
