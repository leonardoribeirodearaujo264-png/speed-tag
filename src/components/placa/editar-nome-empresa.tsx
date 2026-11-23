"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { editarNomeEmpresa } from "@/lib/acoes/empresas";

export function EditarNomeEmpresa({ id, nome }: { id: string; nome: string }) {
  const campo = useId();
  const [resultado, acao, pendente] = useActionState(editarNomeEmpresa.bind(null, id), "");
  return (
    <form className="space-y-2" action={acao}>
      <label htmlFor={campo} className="text-xs font-medium text-slate-600">Nome da empresa</label>
      <div className="flex max-w-md items-center gap-2">
        <Input id={campo} name="nome" defaultValue={nome} maxLength={200} required />
        <Button variant="outline" type="submit" disabled={pendente}>Salvar nome</Button>
      </div>
      {resultado && <p role="status" className="text-sm">{resultado}</p>}
    </form>
  );
}
