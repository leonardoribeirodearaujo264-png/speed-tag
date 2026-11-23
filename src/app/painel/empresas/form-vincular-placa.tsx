"use client";

import { useActionState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vincularEmpresaPlaca } from "./acoes";

export function FormVincularPlaca({ empresa, admin = false }: { empresa: string; admin?: boolean }) {
  const [mensagem, acao, pendente] = useActionState(vincularEmpresaPlaca.bind(null, empresa), "");
  return (
    <form action={acao} className="space-y-3 pt-2">
      <label className="block space-y-1 text-sm font-medium">
        <span>{admin ? "Código da placa" : "Código da sua placa"}</span>
        <Input name="codigo" required maxLength={12} autoCapitalize="characters" autoCorrect="off" className="min-h-11 font-mono uppercase" />
      </label>
      <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm">
        <input type="checkbox" name="confirmar" className="mt-1" required />
        Confirmo que a placa deve abrir a avaliação desta empresa.
      </label>
      <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pendente}>
        {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
        {pendente ? "Vinculando..." : admin ? "Adicionar e ativar placa" : "Vincular placa"}
      </Button>
      {mensagem && <p role="status" className="text-sm">{mensagem}</p>}
    </form>
  );
}
