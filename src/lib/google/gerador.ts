import { consumirCotaGoogle, MENSAGEM_COTA } from "@/lib/google/cota";
import { ehLinkCurto, lerUrlMaps, resolverLinkGoogle, urlGoogleSegura } from "@/lib/google/links-maps";
import { buscarEmpresas, buscarPerto, detalhesEmpresa, esquemaPlaceId, type DetalhesEmpresa, type EmpresaEncontrada } from "@/lib/google/places";

/**
 * Gerador de link de avaliação: transforma um Place ID ou um link colado do Maps nos
 * dados da empresa e no link direto para escrever avaliação. Toda chamada ao Google
 * passa antes pela cota (por IP ou por conta, e o teto diário).
 */

export type EmpresaGerada = DetalhesEmpresa & {
  /** true quando o link não trazia Place ID e a empresa foi achada pelo nome perto do local. */
  aproximado: boolean;
};

export type Falha = { erro: string };

type Contexto = { usuarioId?: string; sessao?: string };

const MENSAGENS_LINK: Record<string, string> = {
  LINK_INVALIDO: "Cole um link do Google Maps (maps.app.goo.gl, google.com/maps ou g.page).",
  FORA_DO_GOOGLE: "Esse link não leva ao Google Maps.",
  NAO_ENCONTRADO: "O Google diz que esse link não existe. Copie de novo pelo botão Compartilhar do Maps.",
  SALTOS_DEMAIS: "Não foi possível abrir esse link. Use a busca pelo nome.",
  SEM_RESPOSTA: "O Google não respondeu agora. Tente de novo ou use a busca pelo nome.",
};

async function comCota<T>(ctx: Contexto, acao: () => Promise<T>, rotulo: string): Promise<T | Falha> {
  if (!(await consumirCotaGoogle(ctx.usuarioId))) return { erro: MENSAGEM_COTA };
  try {
    return await acao();
  } catch (erro) {
    console.error(`[gerador] ${rotulo}`, erro instanceof Error ? erro.message : "erro");
    return { erro: "O Google não respondeu agora. Tente de novo em instantes ou use o link manual." };
  }
}

export async function pesquisarNoGoogle(texto: string, ctx: Contexto): Promise<{ empresas: EmpresaEncontrada[] } | Falha> {
  const consulta = texto.trim();
  if (consulta.length < 3 || consulta.length > 180) return { erro: "Digite pelo menos 3 letras do nome da empresa." };
  const r = await comCota(ctx, () => buscarEmpresas(consulta, ctx.sessao), "busca");
  return Array.isArray(r) ? { empresas: r } : r;
}

export async function gerarPorPlaceId(placeId: string, ctx: Contexto, aproximado = false): Promise<{ empresa: EmpresaGerada } | Falha> {
  if (!esquemaPlaceId.safeParse(placeId).success) return { erro: "Selecione uma empresa da lista." };
  const r = await comCota(ctx, () => detalhesEmpresa(placeId, ctx.sessao), "detalhes");
  if ("erro" in r) return r;
  return { empresa: { ...r, aproximado } };
}

/**
 * Link colado: abre links curtos no servidor (só hosts do Google), lê o Place ID da URL
 * quando existe e, se não existir, procura pelo nome perto das coordenadas do link.
 * Não presume que toda URL do Maps tenha Place ID.
 */
export async function gerarPorLink(texto: string, ctx: Contexto): Promise<{ empresa: EmpresaGerada } | Falha> {
  let url = urlGoogleSegura(texto);
  if (!url) return { erro: MENSAGENS_LINK.LINK_INVALIDO };

  if (ehLinkCurto(url)) {
    const r = await resolverLinkGoogle(url);
    if (!r.ok) return { erro: MENSAGENS_LINK[r.motivo] ?? MENSAGENS_LINK.SEM_RESPOSTA };
    url = r.url;
  }

  const dados = lerUrlMaps(url);
  if (dados.placeId) return gerarPorPlaceId(dados.placeId, ctx);
  if (!dados.nome) {
    return { erro: "Esse link não identifica um estabelecimento. Abra a empresa no Maps, toque em Compartilhar e cole o link, ou use a busca pelo nome." };
  }

  const achadas = await comCota(ctx, () => buscarPerto(dados.nome!, dados.latitude, dados.longitude), "busca aproximada");
  if ("erro" in achadas) return achadas;
  const primeira = achadas[0];
  if (!primeira) return { erro: "Não encontramos esse estabelecimento no Google. Use a busca pelo nome ou o link manual." };
  return gerarPorPlaceId(primeira.id, ctx, true);
}
