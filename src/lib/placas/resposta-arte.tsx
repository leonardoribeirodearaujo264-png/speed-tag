import { ImageResponse } from "next/og";
import { ArtePlaca } from "@/components/placa/arte-placa";
import { fundoArteDataUri } from "./fundo-arte";
import type { ModeloArte } from "./modelos-arte";
import { qrDaArte } from "./qr";
import { urlQr } from "./urls";

// Arte quadrada de 2000 px para download e impressão.
const LADO = 2000;

export async function respostaArtePlaca(codigo: string, modelo: ModeloArte, baixar: boolean) {
  const [qr, fundo] = await Promise.all([qrDaArte(urlQr(codigo)), fundoArteDataUri(modelo)]);
  return new ImageResponse(<ArtePlaca codigo={codigo} qrDataUri={qr} tamanho={LADO} modelo={modelo} fundo={fundo} />, {
    width: LADO,
    height: LADO,
    headers: {
      "Cache-Control": "private, no-store",
      ...(baixar ? { "Content-Disposition": `attachment; filename="placa-${codigo}-${modelo}.png"` } : {}),
    },
  });
}
