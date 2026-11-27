/** Quantas imagens o navegador pede ao servidor ao mesmo tempo (cabe na memória do celular). */
export const CARREGAR_JUNTAS = 4;

/** Baixa a imagem de uma placa já no lado pedido em px (as rotas aceitam ?lado=). */
export async function baixarImagemPlaca(url: string, ladoPx: number): Promise<Blob> {
  const resposta = await fetch(`${url}${url.includes("?") ? "&" : "?"}lado=${Math.round(ladoPx)}`, { credentials: "same-origin" });
  if (!resposta.ok) throw new Error(`Placa ${url.split("/").at(-2)}: erro ${resposta.status} ao gerar a imagem.`);
  return resposta.blob();
}
