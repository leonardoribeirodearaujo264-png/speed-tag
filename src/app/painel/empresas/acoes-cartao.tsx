"use client";

import { useActionState, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Ellipsis, Trash2 } from "lucide-react";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { Button } from "@/components/ui/button";
import { gerenciarEmpresaCliente } from "./acoes";

const botao = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-2.5 text-sm font-medium text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300";

function FormAcao({ id, excluir, link }: { id: string; excluir: boolean; link: string }) {
  const [erro, acao, pendente] = useActionState(gerenciarEmpresaCliente.bind(null, id, excluir ? "excluir" : "editar"), "");
  return (
    <form action={acao} className="space-y-4">
      {excluir ? (
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmar" required /> Confirmo a exclusão da empresa.</label>
      ) : (
        <label className="grid gap-2 text-sm font-medium">
          Link de avaliação do Google
          <input name="link" type="url" defaultValue={link} required maxLength={2048} className="w-full rounded-lg border px-3 py-2 text-base" />
        </label>
      )}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <Button disabled={pendente} variant={excluir ? "destructive" : "default"} className="min-h-11 w-full">
        {excluir ? "Excluir empresa" : "Salvar link"}
      </Button>
    </form>
  );
}

export function EditarLinkEmpresa({ id, link }: { id: string; link: string }) {
  return (
    <DialogoEmpresa tipo="editar" botao="Editar" titulo="Editar link de avaliação" classeBotao={botao}>
      <FormAcao id={id} link={link} excluir={false} />
    </DialogoEmpresa>
  );
}

export function OpcoesEmpresa({ id, nome }: { id: string; nome: string }) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger aria-label={`Mais opções de ${nome}`} className={`${botao} w-11 shrink-0 bg-white/5 px-0`}>
          <Ellipsis className="size-5" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={6} collisionPadding={12} className="z-30">
            <Menu.Popup className="w-44 max-w-[var(--available-width)] rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl">
              <Menu.Item onClick={() => setConfirmando(true)} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-red-300 outline-none data-highlighted:bg-white/10">
                <Trash2 className="size-4" aria-hidden /> Excluir empresa
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <DialogoEmpresa tipo="remover" botao="Excluir empresa" titulo={`Excluir ${nome}?`}
        descricao="As placas vinculadas continuam na conta e ficam disponíveis para uma nova ativação."
        aberto={confirmando} aoMudar={setConfirmando} semGatilho>
        <FormAcao id={id} link="" excluir />
      </DialogoEmpresa>
    </>
  );
}
