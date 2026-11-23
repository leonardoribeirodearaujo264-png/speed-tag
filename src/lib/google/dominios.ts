/**
 * Domínios aceitos como destino de uma placa. Lista oficial; a função
 * public.link_avaliacao_valido() no banco repete a mesma regra como defesa
 * em profundidade. Ao mudar aqui, mude lá também (e o teste de paridade).
 */
const PADROES_PERMITIDOS: ReadonlyArray<{ host: RegExp; caminho: RegExp }> = [
  { host: /^search\.google\.com$/, caminho: /^\// },
  { host: /^www\.google\.com(\.br)?$/, caminho: /^\/maps(\/|$)/ },
  { host: /^maps\.google\.com(\.br)?$/, caminho: /^\// },
  { host: /^g\.page$/, caminho: /^\// },
  { host: /^maps\.app\.goo\.gl$/, caminho: /^\// },
  { host: /^goo\.gl$/, caminho: /^\/maps\// },
];

export const TAMANHO_MAXIMO_LINK = 2048;

export function linkGooglePermitido(link: string): boolean {
  if (link.length > TAMANHO_MAXIMO_LINK) return false;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return false;
  }
  return PADROES_PERMITIDOS.some(
    ({ host, caminho }) => host.test(url.hostname) && caminho.test(url.pathname),
  );
}

export function linkEscreverAvaliacao(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
