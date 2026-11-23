"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { solicitarRecuperacao } from "./acoes";

export function FormRecuperacao({ destino }: { destino: string }) {
  const [estado, acao, pendente] = useActionState(solicitarRecuperacao.bind(null, destino), { tipo: "inicial" });
  if (estado.tipo === "enviado") {
    return <p role="status" className="rounded-xl bg-marca-claro p-4 text-sm text-marca-texto">Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha. Abra o link neste mesmo navegador.</p>;
  }
  return (
    <form action={acao} className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        <span>E-mail da sua conta</span>
        <Input type="email" name="email" autoComplete="email" maxLength={254} required className="min-h-11" />
      </label>
      <Button type="submit" className="min-h-11 w-full" disabled={pendente}>{pendente ? "Enviando..." : "Enviar link de recuperação"}</Button>
      {estado.tipo === "erro" && <p role="alert" className="text-sm text-destructive">{estado.mensagem}</p>}
    </form>
  );
}
