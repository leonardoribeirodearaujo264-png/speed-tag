"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salvarEmpresa } from "@/lib/acoes/empresas";

export function FormEmpresa({ id = null, nome = "", email = "", admin = false, temLink = false, linkAtual }: {
  id?: string | null;
  nome?: string;
  email?: string;
  admin?: boolean;
  temLink?: boolean;
  linkAtual?: string;
}) {
  const [campos, setCampos] = useState({ nome, email, link: linkAtual ?? "" });
  const [estado, enviar, pendente] = useActionState(async (anterior: { mensagem: string; ok: boolean }, dados: FormData) => {
    const resultado = await salvarEmpresa(id, admin, anterior, dados);
    if (resultado.ok && !id) setCampos({ nome: "", email, link: "" });
    return resultado;
  }, { mensagem: "", ok: false });
  const Icone = id ? Save : Plus;
  return (
    <form action={enviar} className="space-y-3">
      {linkAtual !== undefined && <input type="hidden" name="editar_link" value="1" />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium">
          <span>Nome da empresa</span>
          <Input name="nome" autoComplete="organization" className="min-h-11" value={campos.nome} onChange={(e) => setCampos({ ...campos, nome: e.target.value })} maxLength={200} required />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          <span>{!id && admin ? "E-mail da conta da empresa" : id ? "E-mail de contato (opcional)" : "E-mail de contato"}</span>
          <Input name="email" className="min-h-11" type="email" autoComplete="email" value={campos.email} onChange={(e) => setCampos({ ...campos, email: e.target.value })} maxLength={254} required={!id} />
        </label>
      </div>
      {(!temLink || linkAtual !== undefined) && (
        <div className="space-y-2">
          <label className="block space-y-1 text-sm font-medium">
            <span>Link de avaliação do Google (opcional)</span>
            <Input name="link" className="min-h-11" type="url" placeholder="https://g.page/…" value={campos.link} onChange={(e) => setCampos({ ...campos, link: e.target.value })} maxLength={2048} />
          </label>
          {linkAtual !== undefined && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-48 flex-1 text-xs text-slate-600">Ao salvar, as placas vinculadas passam a usar o link informado. Se ficar vazio, elas param de abrir a avaliação.</p>
              {campos.link && <Button type="button" variant="outline" className="min-h-11 w-full px-3 sm:min-h-8 sm:w-auto" onClick={() => setCampos({ ...campos, link: "" })}><X aria-hidden /> Limpar link</Button>}
            </div>
          )}
        </div>
      )}
      {!id && admin && <p className="text-sm text-slate-600">O titular entra com esse e-mail. Se for a primeira vez, ele pode entrar pelo link e definir a senha no painel.</p>}
      {estado.mensagem && (
        <p role={estado.ok ? "status" : "alert"} className={`flex gap-2 rounded-xl px-3 py-2 text-sm ${estado.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {estado.ok && <Check className="size-4 shrink-0" aria-hidden />} {estado.mensagem}
        </p>
      )}
      <div className="border-t border-slate-100 pt-3 sm:text-right">
        <Button type="submit" className="min-h-11 w-full px-4 sm:w-auto" disabled={pendente}>
          {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Icone aria-hidden />}
          {pendente ? "Salvando..." : id ? "Salvar dados" : "Cadastrar empresa"}
        </Button>
      </div>
    </form>
  );
}
