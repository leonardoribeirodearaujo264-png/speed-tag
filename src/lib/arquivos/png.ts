import { crc32 } from "./zip";

const ASSINATURA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const POLEGADA_EM_METROS = 0.0254;
const codificador = new TextEncoder();

function ehPng(png: Uint8Array): boolean {
  return png.length > 33 && ASSINATURA.every((byte, i) => png[i] === byte);
}

/**
 * Grava a resolução (chunk pHYs) no PNG, para a gráfica abrir a arte já no tamanho real:
 * sem ele, os programas assumem 72 dpi e uma placa de 8 cm abre com 33 cm.
 * Substitui um pHYs existente. PNG inválido volta sem alteração.
 */
export function pngComDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (!ehPng(png)) return png;
  const pixelsPorMetro = Math.round(dpi / POLEGADA_EM_METROS);
  const chunks: Uint8Array[] = [png.subarray(0, 8)];
  const leitor = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let pos = 8;
  let inserido = false;
  while (pos + 12 <= png.length) {
    const tamanho = leitor.getUint32(pos);
    const fim = pos + 12 + tamanho;
    if (fim > png.length) return png;
    const tipo = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    if (tipo !== "pHYs") chunks.push(png.subarray(pos, fim));
    if (tipo === "IHDR" && !inserido) {
      chunks.push(chunkPhys(pixelsPorMetro));
      inserido = true;
    }
    pos = fim;
  }
  if (!inserido) return png;
  const saida = new Uint8Array(chunks.reduce((soma, c) => soma + c.length, 0));
  let escrita = 0;
  for (const chunk of chunks) {
    saida.set(chunk, escrita);
    escrita += chunk.length;
  }
  return saida;
}

function chunkPhys(pixelsPorMetro: number): Uint8Array {
  const chunk = new Uint8Array(21);
  const v = new DataView(chunk.buffer);
  v.setUint32(0, 9);
  chunk.set(codificador.encode("pHYs"), 4);
  v.setUint32(8, pixelsPorMetro);
  v.setUint32(12, pixelsPorMetro);
  chunk[16] = 1; // unidade: metro
  v.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/** Lê o dpi gravado no pHYs (null se não houver). */
export function dpiDoPng(png: Uint8Array): number | null {
  if (!ehPng(png)) return null;
  const leitor = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let pos = 8;
  while (pos + 12 <= png.length) {
    const tamanho = leitor.getUint32(pos);
    const tipo = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    if (tipo === "pHYs" && png[pos + 16] === 1) return Math.round(leitor.getUint32(pos + 8) * POLEGADA_EM_METROS);
    pos += 12 + tamanho;
  }
  return null;
}
