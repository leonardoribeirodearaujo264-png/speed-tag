"use client";

import { useEffect, useState } from "react";
import { Download, FolderArchive, Printer, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ItemImpressao } from "./pngs-zip";

type Pronto = { arquivo: File; url: string };
type Tarefa = "pdf" | "zip";
type Progresso = { tarefa: Tarefa; feitas: number; total: number } | null;

function mensagemErro(falha: unknown, oque: string) {
  console.error(`[${oque}]`, falha);
  const detalhe = falha instanceof Error && falha.message.startsWith("Placa ") ? ` ${falha.message}` : "";
  return `Não foi possível gerar ${oque}.${detalhe} Tente novamente.`;
}

/** PDF da folha A4 e ZIP com um PNG por placa (arquivos da gráfica), gerados no navegador. */
export function BotaoImprimir({ itens, lado, nome }: { itens: ItemImpressao[]; lado: number; nome: string }) {
  const [pdf, setPdf] = useState<Pronto>();
  const [zip, setZip] = useState<Pronto>();
  const [progresso, setProgresso] = useState<Progresso>(null);
  const [erro, setErro] = useState("");
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);
  useEffect(() => () => { if (zip) URL.revokeObjectURL(zip.url); }, [zip]);
  const ocupado = progresso !== null;

  async function preparar(tarefa: Tarefa) {
    setErro("");
    setProgresso({ tarefa, feitas: 0, total: itens.length });
    const aoProgredir = (feitas: number, total: number) => setProgresso({ tarefa, feitas, total });
    try {
      if (tarefa === "pdf") {
        const { gerarFolhaPdf } = await import("./folha-pdf");
        const blob = await gerarFolhaPdf(itens.map((i) => i.url), lado, aoProgredir);
        const arquivo = new File([blob], `${nome}.pdf`, { type: "application/pdf" });
        setPdf({ arquivo, url: URL.createObjectURL(arquivo) });
      } else {
        const { gerarZipPngs } = await import("./pngs-zip");
        const blob = await gerarZipPngs(itens, lado, aoProgredir);
        const arquivo = new File([blob], `${nome}-png.zip`, { type: "application/zip" });
        setZip({ arquivo, url: URL.createObjectURL(arquivo) });
      }
    } catch (falha) {
      setErro(mensagemErro(falha, tarefa === "pdf" ? "o PDF" : "os PNGs"));
    } finally {
      setProgresso(null);
    }
  }

  async function compartilhar(pronto: Pronto) {
    setErro("");
    const dados = { files: [pronto.arquivo] };
    if (!navigator.canShare?.(dados)) {
      setErro("Baixe o arquivo e anexe no WhatsApp.");
      return;
    }
    try {
      await navigator.share(dados);
    } catch (falha) {
      if (!(falha instanceof DOMException && falha.name === "AbortError")) setErro("Baixe o arquivo para compartilhar.");
    }
  }

  const rotulo = (tarefa: Tarefa, padrao: string) =>
    progresso?.tarefa === tarefa ? `${tarefa === "pdf" ? "Gerando PDF" : "Gerando PNGs"}... ${progresso.feitas} de ${progresso.total}` : padrao;

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Button onClick={() => window.print()} variant="outline" className="min-h-11"><Printer aria-hidden /> Imprimir</Button>
      {pdf ? (
        <>
          <a href={pdf.url} download={pdf.arquivo.name} className={buttonVariants({ className: "min-h-11" })}><Download aria-hidden /> Baixar PDF</a>
          <Button onClick={() => compartilhar(pdf)} variant="outline" className="min-h-11"><Share2 aria-hidden /> Compartilhar PDF</Button>
        </>
      ) : (
        <Button onClick={() => preparar("pdf")} disabled={ocupado} className="min-h-11"><Download aria-hidden /> {rotulo("pdf", "Gerar PDF")}</Button>
      )}
      {zip ? (
        <>
          <a href={zip.url} download={zip.arquivo.name} className={buttonVariants({ className: "min-h-11" })}><FolderArchive aria-hidden /> Baixar PNGs (ZIP)</a>
          <Button onClick={() => compartilhar(zip)} variant="outline" className="min-h-11"><Share2 aria-hidden /> Compartilhar ZIP</Button>
        </>
      ) : (
        <Button onClick={() => preparar("zip")} disabled={ocupado} variant="outline" className="min-h-11">
          <FolderArchive aria-hidden /> {rotulo("zip", "PNGs para a gráfica (ZIP)")}
        </Button>
      )}
      {erro && <p role="status" className="w-full text-sm text-slate-700">{erro}</p>}
    </div>
  );
}
