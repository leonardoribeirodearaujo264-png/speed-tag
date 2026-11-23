"use client";

import { useActionState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { classeCampo } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { criarUsuarioAcao, type EstadoNovoUsuario } from "./acoes";

export function FormNovoUsuario({ grupo }: { grupo: "revendedor" | "comprador" }) {
  const [estado, acao, criando] = useActionState<EstadoNovoUsuario, FormData>(criarUsuarioAcao, {
    erro: null,
    campos: { nome: "", email: "", telefone: "" },
  });

  return (
    <form action={acao} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Nome completo
          <input name="nome" required maxLength={120} defaultValue={estado.campos.nome} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Telefone
          <input name="telefone" type="tel" inputMode="tel" maxLength={30} defaultValue={estado.campos.telefone} placeholder="(11) 99999-9999" className={classeCampo} />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        E-mail
        <input name="email" type="email" required inputMode="email" defaultValue={estado.campos.email} className={classeCampo} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Tipo de cliente
        <select name="grupo" defaultValue={grupo} className={classeCampo}>
          <option value="revendedor">Revendedor</option>
          <option value="comprador">Comprador de placas</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Senha inicial
        <input name="senha" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className={classeCampo} />
        <span className="text-xs font-normal text-slate-500">
          Mínimo de 10 caracteres. Passe para o cliente por um canal seguro. Se o e-mail já tiver conta, a senha dele não muda.
        </span>
      </label>

      {estado.erro && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {estado.erro}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11 w-full px-5 sm:w-auto sm:self-start" disabled={criando}>
        {criando ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
        {criando ? "Criando..." : "Criar conta do cliente"}
      </Button>
    </form>
  );
}
