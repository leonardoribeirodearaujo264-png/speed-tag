"use client";

import { useActionState, useState } from "react";
import { FormCodigoEmail } from "@/components/auth/form-codigo-email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmarCodigoRecuperacao, solicitarRecuperacao } from "./acoes";

function Solicitacao({ destino, reiniciar }: { destino: string; reiniciar: () => void }) {
  const [estado, acao, pendente] = useActionState(solicitarRecuperacao.bind(null, destino), { tipo: "inicial" });
  if (estado.tipo === "enviado") {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl bg-marca-claro p-4 text-sm text-marca-texto">Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha. Se preferir usar o link, abra-o neste mesmo navegador.</p>
        <FormCodigoEmail acao={confirmarCodigoRecuperacao.bind(null, destino, estado.email)} rotulo="Confirmar código" />
        <Button type="button" variant="link" onClick={reiniciar}>Corrigir e-mail ou solicitar outro código</Button>
      </div>
    );
  }
  return (
    <form action={acao} className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        <span>E-mail da sua conta</span>
        <Input type="email" name="email" autoComplete="email" maxLength={254} required className="min-h-11" />
      </label>
      <Button type="submit" className="min-h-11 w-full" disabled={pendente}>{pendente ? "Enviando..." : "Enviar e-mail de recuperação"}</Button>
      {estado.tipo === "erro" && <p role="alert" className="text-sm text-destructive">{estado.mensagem}</p>}
    </form>
  );
}

export function FormRecuperacao({ destino }: { destino: string }) {
  const [tentativa, setTentativa] = useState(0);
  return <Solicitacao key={tentativa} destino={destino} reiniciar={() => setTentativa((valor) => valor + 1)} />;
}
