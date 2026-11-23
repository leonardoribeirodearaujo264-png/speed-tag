"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { criarTagNfc } from "./acoes";

export function NovaTagNfc() {
  const [erro, acao, pendente] = useActionState(criarTagNfc, "");
  return (
    <form action={acao}>
      <Button type="submit" disabled={pendente}>{pendente ? "Cadastrando..." : "Cadastrar tag NFC"}</Button>
      {erro && <p className="mt-2 text-sm text-destructive" role="alert">{erro}</p>}
    </form>
  );
}
