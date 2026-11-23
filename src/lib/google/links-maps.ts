/**
 * Leitura e resolução de links do Google Maps colados pelo usuário.
 *
 * Segurança (SSRF): o servidor só faz requisição a hosts do Google desta lista, em
 * HTTPS, porta padrão, sem usuário/senha na URL, seguindo redirecionamentos um a um
 * (redirect: "manual") e validando cada destino antes de seguir. Nada de IP, host
 * interno ou domínio de terceiros, e o corpo da resposta nunca é lido.
 */
const HOSTS_BUSCAVEIS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "g.page",
  "g.co",
  "maps.google.com",
  "maps.google.com.br",
  "www.google.com",
  "www.google.com.br",
  "google.com",
  "google.com.br",
  "search.google.com",
]);

/** Destinos finais aceitos sem buscar: tela de login e de consentimento do Google. */
const HOSTS_TERMINAIS = new Set(["accounts.google.com", "consent.google.com"]);

const MAXIMO_SALTOS = 5;
const TEMPO_LIMITE_MS = 5_000;
const TAMANHO_MAXIMO = 2048;

export type DadosLinkMaps = {
  placeId?: string;
  nome?: string;
  latitude?: number;
  longitude?: number;
};

/** Converte o texto colado em URL segura do Google (ou null). Aceita link sem "https://". */
export function urlGoogleSegura(texto: string): URL | null {
  const limpo = texto.trim();
  if (!limpo || limpo.length > TAMANHO_MAXIMO) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`);
  } catch {
    return null;
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS_BUSCAVEIS.has(host) && !HOSTS_TERMINAIS.has(host)) return null;
  return url;
}

const decodificar = (v: string) => {
  try {
    return decodeURIComponent(v.replace(/\+/g, " ")).trim();
  } catch {
    return v.trim();
  }
};

/** Place IDs do Google têm dezenas de caracteres (ex.: ChIJN1t_tDeuEmsRUsoyG83frY4). */
const ehPlaceId = (v: string | null | undefined): v is string => !!v && /^[A-Za-z0-9_-]{16,300}$/.test(v);

/**
 * Extrai o que dá para saber de uma URL do Maps, sem chamar nada. O Place ID só vem
 * quando a própria URL o traz; nome e coordenadas servem para a busca aproximada.
 */
export function lerUrlMaps(url: URL): DadosLinkMaps {
  const dados: DadosLinkMaps = {};
  const p = url.searchParams;
  const texto = decodificar(url.pathname) + " " + decodificar(url.search);

  for (const chave of ["placeid", "place_id", "query_place_id"]) {
    if (ehPlaceId(p.get(chave))) dados.placeId = p.get(chave)!;
  }
  const q = p.get("q") ?? p.get("query") ?? "";
  const placeNoQ = /^place_id:([A-Za-z0-9_-]+)$/.exec(q);
  if (!dados.placeId && placeNoQ && ehPlaceId(placeNoQ[1])) dados.placeId = placeNoQ[1];
  // Links novos do Maps trazem o Place ID dentro de data=...!19sChIJ...
  const noData = /!19s([A-Za-z0-9_-]{10,})/.exec(texto);
  if (!dados.placeId && noData && ehPlaceId(noData[1])) dados.placeId = noData[1];

  const caminho = /\/maps\/(?:place|search)\/([^/@?]+)/.exec(url.pathname);
  if (caminho) dados.nome = decodificar(caminho[1]);
  else if (q && !placeNoQ && !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(q)) dados.nome = decodificar(q);

  const precisas = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(texto);
  const centro = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/.exec(texto);
  const coordQ = /^(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)$/.exec(q);
  const coord = precisas ?? centro ?? coordQ;
  if (coord) {
    const [lat, lng] = [Number(coord[1]), Number(coord[2])];
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      dados.latitude = lat;
      dados.longitude = lng;
    }
  }
  if (dados.nome && dados.nome.length > 200) dados.nome = dados.nome.slice(0, 200);
  return dados;
}

export type Buscador = (url: string, init: RequestInit) => Promise<Response>;

export type Resolucao =
  | { ok: true; url: URL; status: number; terminal: boolean }
  | { ok: false; motivo: "LINK_INVALIDO" | "FORA_DO_GOOGLE" | "NAO_ENCONTRADO" | "SALTOS_DEMAIS" | "SEM_RESPOSTA"; status?: number };

/** Segue redirecionamentos do Google com segurança, até a URL final. */
export async function resolverLinkGoogle(inicial: URL, buscar: Buscador = fetch): Promise<Resolucao> {
  let atual = inicial;
  for (let salto = 0; salto <= MAXIMO_SALTOS; salto++) {
    const host = atual.hostname.toLowerCase();
    if (HOSTS_TERMINAIS.has(host)) {
      // Consentimento de cookies: o destino real vem em "continue".
      const continuar = host === "consent.google.com" ? urlGoogleSegura(atual.searchParams.get("continue") ?? "") : null;
      if (continuar && !HOSTS_TERMINAIS.has(continuar.hostname)) {
        atual = continuar;
        continue;
      }
      return { ok: true, url: atual, status: 200, terminal: true };
    }
    if (!HOSTS_BUSCAVEIS.has(host)) return { ok: false, motivo: "FORA_DO_GOOGLE" };

    let resposta: Response;
    try {
      resposta = await buscar(atual.toString(), {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch {
      return { ok: false, motivo: "SEM_RESPOSTA" };
    }
    void resposta.body?.cancel().catch(() => undefined);

    if (resposta.status >= 300 && resposta.status < 400) {
      const destino = resposta.headers.get("location");
      if (!destino) return { ok: false, motivo: "SEM_RESPOSTA", status: resposta.status };
      let proxima: URL;
      try {
        proxima = new URL(destino, atual);
      } catch {
        return { ok: false, motivo: "LINK_INVALIDO" };
      }
      const segura = urlGoogleSegura(proxima.toString());
      if (!segura) return { ok: false, motivo: "FORA_DO_GOOGLE" };
      atual = segura;
      continue;
    }
    if (resposta.status === 404 || resposta.status === 410) return { ok: false, motivo: "NAO_ENCONTRADO", status: resposta.status };
    if (resposta.status >= 400) return { ok: false, motivo: "SEM_RESPOSTA", status: resposta.status };
    return { ok: true, url: atual, status: resposta.status, terminal: false };
  }
  return { ok: false, motivo: "SALTOS_DEMAIS" };
}

/** Links que precisam ser abertos no servidor para revelar o endereço completo. */
export function ehLinkCurto(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === "maps.app.goo.gl" || host === "goo.gl" || host === "g.page" || host === "g.co";
}

export type VerificacaoLink = { estado: "ok" | "invalido" | "nao_verificado"; detalhe: string };

/**
 * Testa o link final de avaliação antes de salvar. Só reprova o que com certeza não
 * funciona (404, sai do Google); bloqueio temporário do Google não impede a ativação.
 */
export async function verificarLinkAvaliacao(link: string, buscar: Buscador = fetch): Promise<VerificacaoLink> {
  const url = /^https:\/\//i.test(link.trim()) ? urlGoogleSegura(link) : null;
  if (!url) {
    return { estado: "invalido", detalhe: "O link não é um endereço do Google." };
  }
  const r = await resolverLinkGoogle(url, buscar);
  if (r.ok) return { estado: "ok", detalhe: "O Google respondeu ao link." };
  if (r.motivo === "NAO_ENCONTRADO") return { estado: "invalido", detalhe: "O Google diz que este link não existe." };
  if (r.motivo === "FORA_DO_GOOGLE" || r.motivo === "LINK_INVALIDO") return { estado: "invalido", detalhe: "O link leva para fora do Google." };
  return { estado: "nao_verificado", detalhe: "O Google não respondeu agora; o link não pôde ser conferido." };
}
