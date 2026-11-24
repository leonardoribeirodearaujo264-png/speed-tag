"use client";

import { useActionState } from "react";
import { Ellipsis } from "lucide-react";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { Button } from "@/components/ui/button";
import { gerenciarEmpresaCliente } from "./acoes";

const botao = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 text-sm font-medium text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300";

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
  return (
    <details className="relative">
      <summary aria-label={`Mais opcoes de ${nome}`} className={`${botao} w-11 cursor-pointer list-none px-0 [&::-webkit-details-marker]:hidden`}>
        <Ellipsis className="size-5" aria-hidden />
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl">
        <DialogoEmpresa tipo="remover" botao="Excluir empresa" titulo={`Excluir ${nome}?`}
          descricao="As placas vinculadas continuam na conta e ficam disponíveis para uma nova ativação."
          classeBotao="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-red-300 hover:bg-white/10">
          <FormAcao id={id} link="" excluir />
        </DialogoEmpresa>
      </div>
    </details>
  );
}
