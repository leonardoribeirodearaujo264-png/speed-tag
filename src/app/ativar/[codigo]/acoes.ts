"use server";

import { z } from "zod";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { gerarPorLink, gerarPorPlaceId, pesquisarNoGoogle, type EmpresaGerada } from "@/lib/google/gerador";
import { linkAvaliacaoSeguro, esquemaPlaceId, type EmpresaEncontrada } from "@/lib/google/places";
import { ativarPlaca, placaAtivavel, type Erro, type ResultadoAtivacao } from "@/lib/placas/ativacao";

/**
 * Ativação no fluxo do vídeo de referência: "Qual sua empresa?" (busca no Google, link
 * do Maps colado ou link manual), "Quase lá!" (e-mail) e ativação. Não pede senha: a
 * conta do e-mail é encontrada ou criada pelo servidor, e o acesso vai por e-mail.
 * Sem login: as chamadas ao Google passam pela cota por IP e só para placa ativável.
 */

export type { ResultadoAtivacao };

/** Token da sessão de busca do Google (UUID gerado na tela): só repassado se for válido. */
const sessaoValida = (sessao?: string) => (sessao && z.uuid().safeParse(sessao).success ? sessao : undefined);

export async function pesquisarEmpresa(codigo: string, consulta: string, sessao?: string): Promise<{ empresas: EmpresaEncontrada[] } | Erro> {
  const placa = await placaAtivavel(codigo);
  if ("erro" in placa) return placa;
  return pesquisarNoGoogle(consulta, { sessao: sessaoValida(sessao) });
}

export async function verDetalhesEmpresa(codigo: string, placeId: string, sessao?: string): Promise<{ empresa: EmpresaGerada } | Erro> {
  const placa = await placaAtivavel(codigo);
  if ("erro" in placa) return placa;
  return gerarPorPlaceId(placeId, { sessao: sessaoValida(sessao) });
}

/** Link do Google Maps colado pelo cliente (inclusive curto): identifica a empresa. */
export async function identificarPorLink(codigo: string, link: string): Promise<{ empresa: EmpresaGerada } | Erro> {
  const placa = await placaAtivavel(codigo);
  if ("erro" in placa) return placa;
  return gerarPorLink(link, {});
}

/**
 * O link vem do servidor: writeAReviewUri devolvido pelo Google na confirmação, aceito só
 * se for do Google; sem ele, o formulário oficial pelo Place ID.
 */
export async function ativarComGoogle(codigo: string, email: string, placeId: string, nome: string, link?: string): Promise<ResultadoAtivacao> {
  if (!esquemaPlaceId.safeParse(placeId).success) return { erro: "Selecione uma empresa da lista." };
  const nomeLimpo = z.string().trim().min(1).max(200).safeParse(nome);
  if (!nomeLimpo.success) return { erro: "Nome da empresa inválido." };
  return ativarPlaca(codigo, email, "google_places", placeId, nomeLimpo.data, linkAvaliacaoSeguro(placeId, link));
}

export async function ativarComLink(codigo: string, email: string, nome: string, link: string): Promise<ResultadoAtivacao> {
  const entrada = z
    .object({ nome: z.string().trim().min(2, "Digite o nome da empresa.").max(200), link: z.string().trim().max(2048) })
    .safeParse({ nome, link });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos." };
  if (!linkGooglePermitido(entrada.data.link)) {
    return { erro: "Use o link de avaliação do Google (search.google.com, g.page ou maps.app.goo.gl)." };
  }
  return ativarPlaca(codigo, email, "manual", null, entrada.data.nome, entrada.data.link);
}
