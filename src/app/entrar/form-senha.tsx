"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cadastrarCliente, entrarComSenha } from "./acoes";

export function FormCadastro({ destino }: { destino: string }) {
  const [estado, acao, enviando] = useActionState(cadastrarCliente.bind(null, destino), {});
  if (estado.pendente) {
    return <p role="status" className="text-sm">Confira seu e-mail para confirmar a conta. Se já tem cadastro, entre com sua senha.</p>;
  }
  return (
    <form action={acao} className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        <span>E-mail da conta</span>
        <Input name="email" type="email" autoComplete="username" required maxLength={254} />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>Senha</span>
        <Input name="senha" type="password" autoComplete="new-password" required minLength={10} maxLength={72} />
      </label>
      <Button type="submit" className="min-h-11 w-full" disabled={enviando}>{enviando ? "Criando conta..." : "Criar conta"}</Button>
      {estado.erro && <p role="alert" className="text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}

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
