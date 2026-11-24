"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock, Nfc, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { registrarNfcAcao } from "./acoes-nfc";
import { FalhaNfc, MENSAGEM_ERRO_NFC, gravarUrl, lerUrl, nfcSuportado, travarChip } from "@/lib/nfc";

type Props = {
  placaId: string;
  url: string;
  gravadoEm: string | null;
  travado: boolean;
};

type Fase =
  | { tipo: "verificando" }
  | { tipo: "sem_suporte" }
  | { tipo: "pronto" }
  | { tipo: "gravando" }
  | { tipo: "conferindo" }
  | { tipo: "gravado" }
  | { tipo: "confirmar_trava" }
  | { tipo: "travando" }
  | { tipo: "travado" }
  | { tipo: "erro"; mensagem: string };

function mensagemDe(erro: unknown): string {
  return erro instanceof FalhaNfc ? MENSAGEM_ERRO_NFC[erro.tipo] : MENSAGEM_ERRO_NFC.FALHA;
}

export function GravarNfc({ placaId, url, gravadoEm, travado }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: "verificando" });

  useEffect(() => {
    // Suporte só é conhecido no navegador; o render do servidor mostra "verificando".
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com API do navegador
    setFase(travado ? { tipo: "travado" } : nfcSuportado() ? { tipo: "pronto" } : { tipo: "sem_suporte" });
  }, [travado]);

  async function gravar() {
    try {
      setFase({ tipo: "gravando" });
      await gravarUrl(url);
      setFase({ tipo: "conferindo" });
      const lida = await lerUrl();
      if (lida !== url) {
        setFase({ tipo: "erro", mensagem: `O chip devolveu outra URL (${lida ?? "vazio"}). Grave de novo.` });
        return;
      }
      const registro = await registrarNfcAcao({ placaId, travado: false });
      setFase(registro.ok ? { tipo: "gravado" } : { tipo: "erro", mensagem: registro.mensagem });
    } catch (erro) {
      setFase({ tipo: "erro", mensagem: mensagemDe(erro) });
    }
  }

  async function travar() {
    try {
      setFase({ tipo: "travando" });
      await travarChip();
      const registro = await registrarNfcAcao({ placaId, travado: true });
      setFase(registro.ok ? { tipo: "travado" } : { tipo: "erro", mensagem: registro.mensagem });
    } catch (erro) {
      setFase({ tipo: "erro", mensagem: mensagemDe(erro) });
    }
  }

  switch (fase.tipo) {
    case "verificando":
      return <p className="text-sm text-muted-foreground">Verificando suporte a NFC...</p>;

    case "sem_suporte":
      return (
        <Alert>
          <Nfc aria-hidden />
          <AlertTitle>Gravação pelo navegador indisponível aqui</AlertTitle>
          <AlertDescription>
            Abra esta página no Chrome do Android para gravar direto. Em outro aparelho, copie a URL do NFC acima
            e grave com um app como o NFC Tools (registro do tipo URL).
            {gravadoEm && " Este chip já consta como gravado."}
          </AlertDescription>
        </Alert>
      );

    case "gravando":
    case "conferindo":
    case "travando":
      return (
        <div className="flex items-center gap-3 rounded-lg bg-marca-claro p-4 text-marca-texto" role="status" aria-live="polite">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm">
            {fase.tipo === "gravando" && "Encoste o chip atrás do celular e segure parado..."}
            {fase.tipo === "conferindo" && "Gravado. Encoste o chip de novo para conferir..."}
            {fase.tipo === "travando" && "Encoste o chip para travar..."}
          </span>
        </div>
      );

    case "gravado":
      return (
        <div className="flex flex-col gap-3" role="status">
          <p className="flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle2 className="size-5" aria-hidden /> Chip gravado e conferido.
          </p>
          <Button variant="outline" onClick={() => setFase({ tipo: "confirmar_trava" })}>
            <Lock aria-hidden /> Travar chip
          </Button>
        </div>
      );

    case "confirmar_trava":
      return (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Travar é irreversível</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            Depois de travado, ninguém consegue regravar este chip, nem você. O destino continua mudando pelo sistema.
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={travar}>Travar para sempre</Button>
              <Button variant="outline" onClick={() => setFase({ tipo: "gravado" })}>Cancelar</Button>
            </div>
          </AlertDescription>
        </Alert>
      );

    case "travado":
      return (
        <p className="flex items-center gap-2 text-sm font-medium text-green-700" role="status">
          <Lock className="size-4" aria-hidden /> Chip gravado e travado.
        </p>
      );

    case "erro":
      return (
        <div className="flex flex-col gap-3">
          <Alert variant="destructive">
            <AlertDescription>{fase.mensagem}</AlertDescription>
          </Alert>
          <Button onClick={gravar}>Tentar de novo</Button>
        </div>
      );

    case "pronto":
      return (
        <div className="flex flex-col gap-2">
          <Button className="h-11 text-base" onClick={gravar}>
            <Nfc aria-hidden /> {gravadoEm ? "Gravar de novo" : "Gravar NFC"}
          </Button>
          {gravadoEm && (
            <Button variant="outline" onClick={() => setFase({ tipo: "confirmar_trava" })}>
              <Lock aria-hidden /> Travar chip
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Grava a URL do NFC, lê o chip de volta para conferir e registra no sistema.
          </p>
        </div>
      );
  }
}
