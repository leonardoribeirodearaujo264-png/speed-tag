import { ImageResponse } from "next/og";
import { ArtePlaca } from "@/components/placa/arte-placa";
import { fundoArteDataUri } from "./fundo-arte";
import type { ModeloArte } from "./modelos-arte";
import { qrDaArte } from "./qr";
import { urlQr } from "./urls";

// Arte quadrada de 2000 px para download; a folha em PDF pede menor (só o necessário para imprimir).
const LADO = 2000;
const LADO_MINIMO = 300;

/** Lado pedido em ?lado= (px), limitado entre 300 e 2000; inválido ou ausente = 2000. */
export function ladoDaArte(valor: string | null): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= LADO_MINIMO && n <= LADO ? n : LADO;
}

export async function respostaArtePlaca(codigo: string, modelo: ModeloArte, baixar: boolean, lado = LADO) {
  const [qr, fundo] = await Promise.all([qrDaArte(urlQr(codigo)), fundoArteDataUri(modelo)]);
  return new ImageResponse(<ArtePlaca codigo={codigo} qrDataUri={qr} tamanho={lado} modelo={modelo} fundo={fundo} />, {
    width: lado,
    height: lado,
    headers: {
      "Cache-Control": "private, no-store",
      ...(baixar ? { "Content-Disposition": `attachment; filename="placa-${codigo}-${modelo}.png"` } : {}),
    },
  });
}
