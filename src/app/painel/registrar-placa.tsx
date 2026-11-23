"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { registrarPlacaPropria } from "./acoes";

export function RegistrarPlacaPropria({ empresas = false }: { empresas?: boolean }) {
  const [erro, acao, pendente] = useActionState(registrarPlacaPropria.bind(null, empresas), "");
  return (
    <form action={acao} className="space-y-2">
      <Button type="submit" disabled={pendente}>{pendente ? "Cadastrando..." : "Cadastrar minha tag NFC"}</Button>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </form>
  );
}
