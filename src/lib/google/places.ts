import { z } from "zod";
import { envGoogle } from "@/lib/env";

/**
 * Google Places API (New), sempre no servidor. Cada campo pedido no field mask
 * muda o SKU cobrado: a busca pede só id, nome e endereço; os detalhes (nota,
 * total de avaliações, telefone) só são pedidos quando o cliente escolhe uma empresa.
 */
const API_PLACES = "https://places.googleapis.com/v1/places";
export const esquemaPlaceId = z.string().regex(/^[A-Za-z0-9_-]{1,300}$/);

const esquemaLocal = z.object({
  id: esquemaPlaceId,
  displayName: z.object({ text: z.string().trim().min(1) }),
  formattedAddress: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().int().optional(),
  nationalPhoneNumber: z.string().optional(),
});

export type EmpresaEncontrada = { id: string; nome: string; endereco?: string };
export type DetalhesEmpresa = EmpresaEncontrada & { nota?: number; totalAvaliacoes?: number; telefone?: string };

function cabecalhos(campos: string) {
  return { "X-Goog-Api-Key": envGoogle().GOOGLE_PLACES_API_KEY, "X-Goog-FieldMask": campos };
}

const MAXIMO_RESULTADOS = 8;

/** Busca por texto: boa para nome exato ("Padaria França Piracicaba"). */
async function buscarPorTexto(texto: string): Promise<EmpresaEncontrada[]> {
  const resposta = await fetch(`${API_PLACES}:searchText`, {
    method: "POST",
    headers: { ...cabecalhos("places.id,places.displayName,places.formattedAddress"), "Content-Type": "application/json" },
    body: JSON.stringify({
      textQuery: texto,
      languageCode: "pt-BR",
      regionCode: envGoogle().PLACES_REGIAO_PADRAO.toUpperCase(),
      pageSize: MAXIMO_RESULTADOS,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!resposta.ok) throw new Error(`Google Places Text Search HTTP ${resposta.status}`);
  const { places } = z.object({ places: z.array(esquemaLocal).default([]) }).parse(await resposta.json());
  return places.map((local) => ({ id: local.id, nome: local.displayName.text, endereco: local.formattedAddress }));
}

const esquemaSugestoes = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: esquemaPlaceId,
            types: z.array(z.string()).default([]),
            text: z.object({ text: z.string() }).optional(),
            structuredFormat: z
              .object({ mainText: z.object({ text: z.string() }), secondaryText: z.object({ text: z.string() }).optional() })
              .optional(),
          })
          .optional(),
      }),
    )
    .default([]),
});

/** Tipos que não são negócio (rua, cidade, bairro...): ficam fora da lista. */
const TIPOS_NAO_NEGOCIO = new Set([
  "route", "street_address", "locality", "sublocality", "sublocality_level_1", "neighborhood",
  "administrative_area_level_1", "administrative_area_level_2", "postal_code", "country", "geocode", "political",
]);

/**
 * Autocompletar: acha nome incompleto, com erro de digitação ou nome de pessoa, que a
 * busca por texto devolve vazio. O sessionToken agrupa autocompletar + detalhes numa
 * sessão de cobrança do Google.
 */
async function buscarPorAutocompletar(texto: string, sessao?: string): Promise<EmpresaEncontrada[]> {
  const resposta = await fetch(`${API_PLACES}:autocomplete`, {
    method: "POST",
    headers: { "X-Goog-Api-Key": envGoogle().GOOGLE_PLACES_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: texto,
      languageCode: "pt-BR",
      includedRegionCodes: [envGoogle().PLACES_REGIAO_PADRAO],
      ...(sessao ? { sessionToken: sessao } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!resposta.ok) throw new Error(`Google Places Autocomplete HTTP ${resposta.status}`);
  const { suggestions } = esquemaSugestoes.parse(await resposta.json());
  return suggestions.flatMap(({ placePrediction: p }) => {
    if (!p || p.types.some((t) => TIPOS_NAO_NEGOCIO.has(t))) return [];
    const nome = p.structuredFormat?.mainText.text ?? p.text?.text ?? "";
    return nome ? [{ id: p.placeId, nome, endereco: p.structuredFormat?.secondaryText?.text }] : [];
  });
}

/** Junta busca por texto e autocompletar, sem repetir empresa, e no máximo 8 resultados. */
export async function buscarEmpresas(texto: string, sessao?: string): Promise<EmpresaEncontrada[]> {
  const porTexto = await buscarPorTexto(texto);
  if (porTexto.length >= 5) return porTexto.slice(0, MAXIMO_RESULTADOS);

  let porAutocompletar: EmpresaEncontrada[] = [];
  try {
    porAutocompletar = await buscarPorAutocompletar(texto, sessao);
  } catch (erro) {
    // Autocompletar é complemento: se falhar, fica o que a busca por texto achou.
    if (porTexto.length === 0) throw erro;
  }
  const vistos = new Set(porTexto.map((e) => e.id));
  return [...porTexto, ...porAutocompletar.filter((e) => !vistos.has(e.id))].slice(0, MAXIMO_RESULTADOS);
}

export async function detalhesEmpresa(id: string, sessao?: string): Promise<DetalhesEmpresa> {
  const url = new URL(`${API_PLACES}/${encodeURIComponent(id)}`);
  url.searchParams.set("languageCode", "pt-BR");
  if (sessao) url.searchParams.set("sessionToken", sessao);
  const resposta = await fetch(url, {
    headers: cabecalhos("id,displayName,formattedAddress,rating,userRatingCount,nationalPhoneNumber"),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!resposta.ok) throw new Error(`Google Places Details HTTP ${resposta.status}`);
  const local = esquemaLocal.parse(await resposta.json());
  if (local.id !== id) throw new Error("Google Places retornou outro estabelecimento");
  return {
    id: local.id,
    nome: local.displayName.text,
    endereco: local.formattedAddress,
    nota: local.rating,
    totalAvaliacoes: local.userRatingCount,
    telefone: local.nationalPhoneNumber,
  };
}
