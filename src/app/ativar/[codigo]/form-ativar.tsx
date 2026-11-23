"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmpresaEncontrada } from "@/lib/google/places";
import { confirmarEmpresaNfc, pesquisarEmpresaNfc } from "./acoes";

export function FormAtivarNfc({ codigo, exigeSegredo }: { codigo: string; exigeSegredo: boolean }) {
  const router = useRouter();
  const [segredo, setSegredo] = useState("");
  const [consulta, setConsulta] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaEncontrada[] | null>(null);
  const [selecionada, setSelecionada] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();

  function limparBusca() {
    setEmpresas(null);
    setSelecionada("");
    setErro("");
  }

  function executar(tarefa: () => Promise<void>) {
    iniciar(async () => {
      try {
        await tarefa();
      } catch {
        setErro("Não foi possível concluir. Tente novamente.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Tag <strong>{codigo}</strong></p>
      <form className="space-y-4" onSubmit={(evento) => {
        evento.preventDefault();
        limparBusca();
        executar(async () => {
          const resultado = await pesquisarEmpresaNfc(codigo, segredo, consulta);
          setErro(resultado.erro ?? "");
          setEmpresas(resultado.empresas ?? null);
        });
      }}>
        {exigeSegredo && (
          <div className="space-y-2">
            <Label htmlFor="segredo">Código secreto da entrega</Label>
            <Input id="segredo" type="password" autoComplete="off" maxLength={80} required disabled={ocupado}
              value={segredo} onChange={(evento) => { setSegredo(evento.target.value); limparBusca(); }} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="empresa">Nome da empresa e cidade</Label>
          <Input id="empresa" required minLength={3} maxLength={180} disabled={ocupado}
            value={consulta} onChange={(evento) => { setConsulta(evento.target.value); limparBusca(); }} />
        </div>
        <Button type="submit" disabled={ocupado}>Buscar no Google Maps</Button>
      </form>
      {empresas?.length === 0 && <p role="status" className="text-sm">Nenhuma empresa encontrada. Tente incluir a cidade ou o endereço.</p>}
      {empresas && empresas.length > 0 && (
        <fieldset disabled={ocupado} className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Selecione o estabelecimento</legend>
          {empresas.map((empresa) => (
            <label key={empresa.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
              <input type="radio" name="estabelecimento" className="mt-1" checked={selecionada === empresa.id}
                onChange={() => { setSelecionada(empresa.id); setErro(""); }} />
              <span><strong className="block">{empresa.nome}</strong>{empresa.endereco}</span>
            </label>
          ))}
          <p className="text-right text-sm font-medium">Google Maps</p>
          <Button disabled={ocupado || !selecionada} onClick={() => {
            setErro("");
            executar(async () => {
              const resultado = await confirmarEmpresaNfc(codigo, segredo, selecionada);
              setErro(resultado.erro ?? "");
              if (resultado.ativada) router.refresh();
            });
          }}>Confirmar empresa e ativar tag</Button>
        </fieldset>
      )}
      {ocupado && <p role="status" className="text-sm">Aguarde...</p>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
