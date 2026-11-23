"use client";

import { useActionState } from "react";
import { Loader2, Mail, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { atualizarPerfilCliente } from "./acoes";

export function FormPerfil({ nome, email }: { nome: string; email: string }) {
  const [mensagem, acao, pendente] = useActionState(atualizarPerfilCliente, "");
  return (
    <form action={acao} className="space-y-3 sm:max-w-sm">
      <label className="block space-y-1 text-sm font-medium">
        <span>Seu nome</span>
        <Input name="nome" autoComplete="name" defaultValue={nome} required maxLength={120} className="min-h-11" />
      </label>
      {email && <p className="flex items-start gap-2 break-all text-sm text-slate-600"><Mail className="mt-0.5 size-4 shrink-0" aria-hidden /> {email}</p>}
      <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={pendente}>
        {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        {pendente ? "Salvando..." : "Salvar nome"}
      </Button>
      {mensagem && <p role="status" className="text-sm">{mensagem}</p>}
    </form>
  );
}
