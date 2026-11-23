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

export async function buscarEmpresas(texto: string): Promise<EmpresaEncontrada[]> {
  const resposta = await fetch(`${API_PLACES}:searchText`, {
    method: "POST",
    headers: { ...cabecalhos("places.id,places.displayName,places.formattedAddress"), "Content-Type": "application/json" },
    body: JSON.stringify({
      textQuery: texto,
      languageCode: "pt-BR",
      regionCode: envGoogle().PLACES_REGIAO_PADRAO.toUpperCase(),
      pageSize: 8,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!resposta.ok) throw new Error(`Google Places Text Search HTTP ${resposta.status}`);
  const { places } = z.object({ places: z.array(esquemaLocal).default([]) }).parse(await resposta.json());
  return places.map((local) => ({ id: local.id, nome: local.displayName.text, endereco: local.formattedAddress }));
}

export async function detalhesEmpresa(id: string): Promise<DetalhesEmpresa> {
  const url = new URL(`${API_PLACES}/${encodeURIComponent(id)}`);
  url.searchParams.set("languageCode", "pt-BR");
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
