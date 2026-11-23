"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FormCodigoEmail({ acao, rotulo }: {
  acao: (anterior: string, dados: FormData) => Promise<string>;
  rotulo: string;
}) {
  const [erro, enviar, pendente] = useActionState(acao, "");
  return (
    <form action={enviar} className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        <span>Código recebido por e-mail</span>
        <Input name="codigo" type="text" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6,10}" minLength={6} maxLength={10} required className="min-h-11 font-mono tracking-widest" />
      </label>
      <Button type="submit" className="min-h-11 w-full" disabled={pendente}>{pendente ? "Verificando..." : rotulo}</Button>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </form>
  );
}
