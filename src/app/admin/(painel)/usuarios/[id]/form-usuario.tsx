"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PapelUsuario } from "@/lib/supabase/tipos";
import { salvarUsuario, type EstadoEdicaoUsuario } from "./acoes";

type Props = {
  usuarioId: string;
  nome: string | null;
  telefone: string | null;
  papel: PapelUsuario;
  bloqueado: boolean;
  ehVoce: boolean;
};

const classeCampo =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-marca focus:ring-4 focus:ring-marca/15 disabled:bg-slate-50 disabled:text-slate-500";

export function FormUsuario({ usuarioId, nome, telefone, papel, bloqueado, ehVoce }: Props) {
  const [estado, acao, salvando] = useActionState<EstadoEdicaoUsuario, FormData>(salvarUsuario, { tipo: "inicial" });

  useEffect(() => {
    if (estado.tipo === "sucesso") toast.success("Alterações salvas.");
    if (estado.tipo === "erro") toast.error(estado.mensagem);
  }, [estado]);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Nome
          <input name="nome" defaultValue={nome ?? ""} maxLength={120} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Telefone
          <input name="telefone" type="tel" inputMode="tel" defaultValue={telefone ?? ""} maxLength={30} placeholder="(11) 99999-9999" className={classeCampo} />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Permissão
        <select name="papel" defaultValue={papel} disabled={ehVoce} className={classeCampo}>
          <option value="cliente">Cliente: vê e edita só as próprias placas</option>
          <option value="admin">Administrador: acesso total ao painel</option>
        </select>
        {ehVoce && <input type="hidden" name="papel" value={papel} />}
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-red-200 has-[:checked]:bg-red-50/50">
        <input
          type="checkbox"
          name="bloqueado"
          defaultChecked={bloqueado}
          disabled={ehVoce}
          className="mt-0.5 size-4 accent-red-600"
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">Bloquear acesso ao painel</span>
          <span className="block text-sm text-slate-500">
            A pessoa não entra mais no painel das placas. As placas dela continuam funcionando, e o login da loja não é afetado.
          </span>
        </span>
      </label>

      {ehVoce && <p className="text-sm text-slate-500">Esta é a sua conta: permissão e bloqueio não podem ser alterados por você.</p>}

      <Button type="submit" size="lg" className="self-start px-5" disabled={salvando}>
        {salvando ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        {salvando ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
