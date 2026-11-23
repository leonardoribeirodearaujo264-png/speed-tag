import { z } from "zod";
import { envGoogle } from "@/lib/env";
import { linkEscreverAvaliacao, linkGooglePermitido } from "@/lib/google/dominios";

const API_PLACES = "https://places.googleapis.com/v1/places";
export const esquemaPlaceId = z.string().regex(/^[A-Za-z0-9_-]{1,300}$/);
const esquemaLocal = z.object({
  id: esquemaPlaceId,
  displayName: z.object({ text: z.string().trim().min(1) }),
  formattedAddress: z.string().optional(),
  googleMapsLinks: z.object({ writeAReviewUri: z.string().optional() }).optional(),
});

export type EmpresaEncontrada = { id: string; nome: string; endereco?: string };

function cabecalhos(campos: string) {
  return { "X-Goog-Api-Key": envGoogle().GOOGLE_PLACES_API_KEY, "X-Goog-FieldMask": campos };
}

export async function buscarEmpresas(texto: string): Promise<EmpresaEncontrada[]> {
  const resposta = await fetch(`${API_PLACES}:searchText`, {
    method: "POST",
    headers: { ...cabecalhos("places.id,places.displayName,places.formattedAddress"), "Content-Type": "application/json" },
    body: JSON.stringify({
      textQuery: texto, languageCode: "pt-BR", regionCode: envGoogle().PLACES_REGIAO_PADRAO.toUpperCase(), pageSize: 8,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!resposta.ok) throw new Error(`Google Places Text Search HTTP ${resposta.status}`);
  const { places } = z.object({ places: z.array(esquemaLocal).default([]) }).parse(await resposta.json());
  return places.map((local) => ({ id: local.id, nome: local.displayName.text, endereco: local.formattedAddress }));
}

export async function obterEmpresaParaAtivacao(id: string) {
  const url = new URL(`${API_PLACES}/${encodeURIComponent(id)}`);
  url.searchParams.set("languageCode", "pt-BR");
  const resposta = await fetch(url, {
    headers: cabecalhos("id,displayName,googleMapsLinks.writeAReviewUri"),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!resposta.ok) throw new Error(`Google Places Details HTTP ${resposta.status}`);
  const local = esquemaLocal.parse(await resposta.json());
  if (local.id !== id) throw new Error("Google Places retornou outro estabelecimento");
  const oficial = local.googleMapsLinks?.writeAReviewUri;
  return {
    id: local.id,
    nome: [...local.displayName.text].slice(0, 200).join(""),
    link: oficial && linkGooglePermitido(oficial) ? oficial : linkEscreverAvaliacao(local.id),
  };
}
