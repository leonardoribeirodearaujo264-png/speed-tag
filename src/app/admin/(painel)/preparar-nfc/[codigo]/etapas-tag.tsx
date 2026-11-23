"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FalhaNfc, gravarUrl, lerUrl, MENSAGEM_ERRO_NFC, nfcSuportado } from "@/lib/nfc";
import type { EtapaNfc } from "@/lib/placas/preparo-nfc";
import { registrarEtapaNfc } from "../acoes";

type Props = { codigo: string; url: string; gravada: boolean; testada: boolean; entregue: boolean; encerrada: boolean };
const observarSuporte = () => () => {};
const suporteServidor = () => false;

export function EtapasTag({ codigo, url, gravada, testada, entregue, encerrada }: Props) {
  const suportado = useSyncExternalStore(observarSuporte, nfcSuportado, suporteServidor);
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  function executar(etapa: EtapaNfc, comLeitor = false) {
    setErro("");
    setMensagem("");
    iniciar(async () => {
      try {
        if (comLeitor && etapa === "gravada") {
          setMensagem("Aproxime a tag da parte de trás do celular e mantenha-a parada.");
          await gravarUrl(url);
        }
        if (comLeitor && etapa === "testada") {
          setMensagem("Aproxime a tag para conferir a URL gravada.");
          if ((await lerUrl()) !== url) {
            setErro("A tag lida contém uma URL diferente ou está vazia.");
            return;
          }
        }
        setMensagem("");
        const resultado = await registrarEtapaNfc(codigo, etapa);
        if (resultado.erro) setErro(resultado.erro);
      } catch (falha) {
        setErro(falha instanceof FalhaNfc ? MENSAGEM_ERRO_NFC[falha.tipo] : "Não foi possível concluir. Tente novamente.");
      } finally {
        setMensagem("");
      }
    });
  }

  if (encerrada) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!gravada && suportado && <Button disabled={pendente} onClick={() => executar("gravada", true)}>Gravar pelo navegador</Button>}
        {!gravada && <Button variant="outline" disabled={pendente} onClick={() => executar("gravada")}>Já gravei pelo NFC Tools</Button>}
        {gravada && !testada && suportado && <Button disabled={pendente} onClick={() => executar("testada", true)}>Ler e testar tag</Button>}
        {gravada && !testada && <Button variant="outline" disabled={pendente} onClick={() => executar("testada")}>Testei, está funcionando</Button>}
        {testada && !entregue && <Button disabled={pendente} onClick={() => executar("entregue")}>Registrar entrega ao cliente</Button>}
        {entregue && <p className="text-sm text-slate-500">Entrega registrada. Agora é com o cliente: ele ativa pelo QR, pelo NFC ou pelo link de ativação.</p>}
      </div>
      {pendente && <p role="status" className="text-sm">{mensagem || "Salvando etapa..."}</p>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
