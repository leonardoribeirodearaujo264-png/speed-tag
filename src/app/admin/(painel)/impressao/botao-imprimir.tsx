"use client";

import { useEffect, useState } from "react";
import { Download, Printer, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function BotaoImprimir({ urls, lado, nome }: { urls: string[]; lado: number; nome: string }) {
  const [pdf, setPdf] = useState<{ arquivo: File; url: string }>();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);

  async function preparar() {
    setOcupado(true);
    setErro("");
    try {
      const { gerarFolhaPdf } = await import("./folha-pdf");
      const blob = await gerarFolhaPdf(urls, lado);
      const arquivo = new File([blob], nome, { type: "application/pdf" });
      setPdf({ arquivo, url: URL.createObjectURL(arquivo) });
    } catch {
      setErro("Não foi possível gerar o PDF. Tente novamente ou baixe a imagem PNG.");
    } finally {
      setOcupado(false);
    }
  }

  async function compartilhar() {
    if (!pdf) return;
    setErro("");
    const dados = { files: [pdf.arquivo] };
    if (!navigator.canShare?.(dados)) {
      setErro("Baixe o PDF e anexe o arquivo no WhatsApp.");
      return;
    }
    try {
      await navigator.share(dados);
    } catch (falha) {
      if (!(falha instanceof DOMException && falha.name === "AbortError")) setErro("Baixe o PDF para compartilhar o arquivo.");
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Button onClick={() => window.print()} variant="outline" className="min-h-11"><Printer aria-hidden /> Imprimir</Button>
      {pdf ? (
        <>
          <a href={pdf.url} download={pdf.arquivo.name} className={buttonVariants({ className: "min-h-11" })}><Download aria-hidden /> Baixar PDF</a>
          <Button onClick={compartilhar} variant="outline" className="min-h-11"><Share2 aria-hidden /> Compartilhar PDF</Button>
        </>
      ) : (
        <Button onClick={preparar} disabled={ocupado} className="min-h-11"><Download aria-hidden /> {ocupado ? "Gerando PDF..." : "Preparar PDF"}</Button>
      )}
      {erro && <p role="status" className="w-full text-sm text-slate-700">{erro}</p>}
    </div>
  );
}
