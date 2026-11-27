import QRCode from "qrcode";

/**
 * Correção de erro Q (~25%): aguenta arranhão e reflexo no acrílico.
 * Margem de 4 módulos é o mínimo da norma. Escuro sobre claro, nunca invertido.
 */
const OPCOES = {
  errorCorrectionLevel: "Q",
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
} as const;

export const TAMANHO_PNG_PADRAO = 1024;
export const TAMANHO_PNG_MIN = 128;
export const TAMANHO_PNG_MAX = 4096;

/** H (~30%): usado quando o código da placa fica impresso no meio do QR, cobrindo parte dele. */
export type NivelCorrecao = "Q" | "H";

export function gerarQrSvg(
  texto: string,
  { transparente = false, nivel = OPCOES.errorCorrectionLevel }: { transparente?: boolean; nivel?: NivelCorrecao } = {},
): Promise<string> {
  // Transparente só dentro da arte da placa: a margem fica sobre o branco do cartão
  // e não cobre a moldura arredondada do quadrado do QR.
  const color = transparente ? { ...OPCOES.color, light: "#ffffff00" } : OPCOES.color;
  return QRCode.toString(texto, { ...OPCOES, errorCorrectionLevel: nivel, color, type: "svg" });
}

/** QR da etiqueta (fundo branco). Com o código no meio, sobe a correção para H. */
export async function qrDaEtiqueta(texto: string, codigoNoMeio: boolean): Promise<string> {
  return svgParaDataUri(await gerarQrSvg(texto, { nivel: codigoNoMeio ? "H" : "Q" }));
}

/** QR em data URI pronto para a arte da placa (fundo transparente). */
export async function qrDaArte(texto: string): Promise<string> {
  return svgParaDataUri(await gerarQrSvg(texto, { transparente: true }));
}

export function gerarQrPng(texto: string, largura = TAMANHO_PNG_PADRAO): Promise<Buffer> {
  const tamanho = Math.min(TAMANHO_PNG_MAX, Math.max(TAMANHO_PNG_MIN, Math.round(largura)));
  return QRCode.toBuffer(texto, { ...OPCOES, type: "png", width: tamanho });
}

export function svgParaDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
