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

export function gerarQrSvg(texto: string): Promise<string> {
  return QRCode.toString(texto, { ...OPCOES, type: "svg" });
}

export function gerarQrPng(texto: string, largura = TAMANHO_PNG_PADRAO): Promise<Buffer> {
  const tamanho = Math.min(TAMANHO_PNG_MAX, Math.max(TAMANHO_PNG_MIN, Math.round(largura)));
  return QRCode.toBuffer(texto, { ...OPCOES, type: "png", width: tamanho });
}

export function svgParaDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
