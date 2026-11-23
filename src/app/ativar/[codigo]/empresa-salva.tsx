"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ativarComEmpresaSalva } from "./acoes";

export function EmpresaSalva({ codigo, empresas, empresaPreferida }: {
  codigo: string; empresas: { id: string; nome: string }[]; empresaPreferida?: string;
}) {
  const [erro, acao, pendente] = useActionState(ativarComEmpresaSalva.bind(null, codigo), "");
  const escolhida = empresas.find(({ id }) => id === empresaPreferida)?.id;
  return (
    <details open={escolhida ? true : undefined} className="mb-5 rounded-xl border border-marca-borda bg-marca-claro/40 p-3">
      <summary className="cursor-pointer font-medium text-marca-texto">Usar uma empresa já cadastrada</summary>
      <form action={acao} className="mt-3 space-y-3">
        <label className="block space-y-1 text-sm font-medium">
          <span>Empresa da minha conta</span>
          <select name="empresa" required defaultValue={escolhida ?? ""} className="h-11 w-full rounded-lg border bg-white px-2">
            <option value="" disabled>Selecione a empresa</option>
            {empresas.map(({ id, nome }) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <Button type="submit" className="min-h-11 w-full" disabled={pendente}>Ativar para esta empresa</Button>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      </form>
    </details>
  );
}
