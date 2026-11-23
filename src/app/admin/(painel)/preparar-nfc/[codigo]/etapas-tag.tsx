"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { BotaoCopiar } from "@/components/admin/botao-copiar";
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
  const [segredo, setSegredo] = useState<string>();
  const [confirmando, setConfirmando] = useState(false);

  function executar(etapa: EtapaNfc, comLeitor = false) {
    setErro("");
    setMensagem("");
    setConfirmando(false);
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
        if (resultado.segredo) setSegredo(resultado.segredo);
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
      {!entregue && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Como gravar e testar</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>No Chrome para Android, abra o painel por HTTPS, ligue o NFC e use uma tag NDEF gravável. Selecione «Gravar pelo navegador» e aproxime apenas a tag que quer preparar.</li>
            <li>No NFC Tools, copie o endereço permanente, abra «Gravar», adicione um registro «URL/URI», cole o endereço e toque em «Gravar». Aproxime a tag e registre a gravação no painel.</li>
            <li>Leia a tag no NFC Tools e compare a URL inteira ou use «Ler e testar tag». Abra a URL em um celular e confira o código da tag antes de entregá-la.</li>
          </ol>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        {!gravada && suportado && <Button disabled={pendente} onClick={() => executar("gravada", true)}>Gravar pelo navegador</Button>}
        {!gravada && <Button variant="outline" disabled={pendente} onClick={() => executar("gravada")}>Registrar gravação manual</Button>}
        {gravada && !testada && suportado && <Button disabled={pendente} onClick={() => executar("testada", true)}>Ler e testar tag</Button>}
        {gravada && !testada && <Button variant="outline" disabled={pendente} onClick={() => executar("testada")}>Confirmar teste manual</Button>}
        {testada && !entregue && <Button disabled={pendente} onClick={() => executar("entregue")}>Registrar entrega e gerar segredo</Button>}
        {entregue && !confirmando && <Button variant="outline" disabled={pendente} onClick={() => setConfirmando(true)}>Gerar novo segredo</Button>}
      </div>
      {confirmando && (
        <div className="space-y-2 text-sm">
          <p>O segredo atual perde a validade assim que o novo for gerado.</p>
          <div className="flex gap-2">
            <Button onClick={() => executar("novo_segredo")}>Confirmar novo segredo</Button>
            <Button variant="outline" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      {segredo && (
        <div className="space-y-2 rounded-lg bg-marca-claro p-3 text-sm" role="status">
          <p>Copie agora e entregue em particular ao cliente. O segredo só aparece nesta operação.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all font-semibold">{segredo}</code>
            <BotaoCopiar texto={segredo} rotulo="código secreto" />
          </div>
        </div>
      )}
      {pendente && <p role="status" className="text-sm">{mensagem || "Salvando etapa..."}</p>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
