"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entrarComSenha } from "./acoes";

export function FormSenha({ destino }: { destino: string }) {
  const [erro, acao, pendente] = useActionState(entrarComSenha.bind(null, destino), "");
  return (
    <form action={acao} className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        <span>E-mail da conta</span>
        <Input name="email" type="email" autoComplete="username" className="min-h-11" required maxLength={254} />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>Senha</span>
        <Input name="senha" type="password" autoComplete="current-password" className="min-h-11" required maxLength={200} />
      </label>
      <Button type="submit" className="min-h-11 w-full" disabled={pendente}>{pendente ? "Entrando..." : "Entrar com senha"}</Button>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </form>
  );
}
