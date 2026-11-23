"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reivindicarTag } from "./acoes";

export function ReivindicarTag({ codigo }: { codigo: string }) {
  const [erro, acao, pendente] = useActionState(reivindicarTag.bind(null, codigo), "");
  return (
    <form action={acao} className="space-y-4">
      <h1 className="text-xl font-semibold">Vincular placa {codigo}</h1>
      <label className="block space-y-2 text-sm">
        <span>Código de ativação recebido na compra</span>
        <Input name="segredo" type="password" maxLength={80} required autoComplete="off" />
      </label>
      <Button type="submit" disabled={pendente}>{pendente ? "Validando..." : "Vincular à minha conta"}</Button>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </form>
  );
}
