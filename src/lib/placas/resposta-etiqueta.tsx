import { ImageResponse } from "next/og";
import { EtiquetaQr, type PosicaoCodigo } from "@/components/placa/etiqueta-qr";
import { qrDaEtiqueta } from "./qr";
import { urlQr } from "./urls";

/** PNG da etiqueta só com QR e código (folha de QR Codes e arquivos da gráfica). */
export async function respostaEtiquetaQr(codigo: string, posicao: PosicaoCodigo, baixar: boolean, lado: number) {
  const qr = await qrDaEtiqueta(urlQr(codigo), posicao === "meio");
  return new ImageResponse(<EtiquetaQr codigo={codigo} qrDataUri={qr} tamanho={lado} posicao={posicao} />, {
    width: lado,
    height: lado,
    headers: {
      "Cache-Control": "private, no-store",
      ...(baixar ? { "Content-Disposition": `attachment; filename="qr-${codigo}.png"` } : {}),
    },
  });
}
