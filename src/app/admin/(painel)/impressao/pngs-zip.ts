import { pngComDpi } from "@/lib/arquivos/png";
import { criarZip, type ArquivoZip } from "@/lib/arquivos/zip";
import { CARREGAR_JUNTAS, baixarImagemPlaca } from "./carregar-imagem";

/** Resolução dos arquivos da gráfica. */
export const DPI_GRAFICA = 300;

export type ItemImpressao = { codigo: string; url: string };

/** Lado em px para imprimir `ladoCm` a 300 dpi. */
export function ladoPxGrafica(ladoCm: number): number {
  return Math.round((ladoCm / 2.54) * DPI_GRAFICA);
}

/**
 * Monta no navegador um ZIP com um PNG por placa, nomeado pelo código, a 300 dpi no
 * tamanho real (dpi gravado no arquivo) e sem a folha branca em volta.
 */
export async function gerarZipPngs(itens: readonly ItemImpressao[], ladoCm: number, aoProgredir?: (feitas: number, total: number) => void) {
  if (!itens.length) throw new Error("A folha está vazia.");
  const lado = ladoPxGrafica(ladoCm);
  const arquivos: ArquivoZip[] = [];
  aoProgredir?.(0, itens.length);
  for (let inicio = 0; inicio < itens.length; inicio += CARREGAR_JUNTAS) {
    const grupo = itens.slice(inicio, inicio + CARREGAR_JUNTAS);
    const imagens = await Promise.all(grupo.map(async ({ url }) => new Uint8Array(await (await baixarImagemPlaca(url, lado)).arrayBuffer())));
    imagens.forEach((png, i) => arquivos.push({ nome: `${grupo[i].codigo}.png`, conteudo: pngComDpi(png, DPI_GRAFICA) }));
    aoProgredir?.(arquivos.length, itens.length);
  }
  const zip = criarZip(arquivos);
  return new Blob([new Uint8Array(zip)], { type: "application/zip" });
}
