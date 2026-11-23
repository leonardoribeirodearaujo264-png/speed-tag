"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { classeCampo } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { Perfil } from "@/lib/supabase/tipos";
import { salvarUsuario, type EstadoEdicaoUsuario } from "./acoes";

type Props = {
  usuarioId: string;
  nome: string | null;
  telefone: string | null;
  limite: number | null;
  bloqueado: boolean;
  administrador: boolean;
  grupo: Perfil["grupo_cliente"];
};

export function FormUsuario({ usuarioId, nome, telefone, limite, bloqueado, administrador, grupo }: Props) {
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

      <p className="text-sm font-medium">{administrador ? "Administrador" : "Cliente"}</p>
      {!administrador && (
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Tipo de cliente
          <select name="grupo" defaultValue={grupo ?? ""} className={classeCampo}>
            <option value="">A classificar</option>
            <option value="revendedor">Revendedor</option>
            <option value="comprador">Comprador de placas</option>
          </select>
        </label>
      )}
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Limite de placas
        <input type="number" name="limite" min={0} max={10000} defaultValue={limite ?? ""} placeholder="Sem limite" className={classeCampo} />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-red-200 has-[:checked]:bg-red-50/50">
        <input
          type="checkbox"
          name="bloqueado"
          defaultChecked={bloqueado}
          disabled={administrador}
          className="mt-0.5 size-4 accent-red-600"
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">Bloquear acesso ao painel</span>
          <span className="block text-sm text-slate-500">
            A pessoa não entra mais no painel das placas. As placas dela continuam funcionando, e o login da loja não é afetado.
          </span>
        </span>
      </label>

      {administrador && <p className="text-sm text-slate-500">As permissões desta conta administrativa são protegidas.</p>}

      <Button type="submit" size="lg" className="h-11 w-full px-5 sm:w-auto sm:self-start" disabled={salvando}>
        {salvando ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        {salvando ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
