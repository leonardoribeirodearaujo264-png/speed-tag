"use server";

import { z } from "zod";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { gerarPorLink, gerarPorPlaceId, pesquisarNoGoogle, type EmpresaGerada } from "@/lib/google/gerador";
import { linkAvaliacaoSeguro, esquemaPlaceId, type EmpresaEncontrada } from "@/lib/google/places";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { codigoValido } from "@/lib/codigos";
import { hashSegredoNfc } from "@/lib/placas/segredo-nfc";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import type { OrigemEmpresa } from "@/lib/supabase/tipos";
import { placaAtivavel as placaAtivavelPublica, type Erro, type ResultadoAtivacao } from "@/lib/placas/ativacao";
import { ativarPeloNfc, type ResultadoPedido } from "@/lib/placas/ativacao-email";

async function placaAtivavel(codigo: string): Promise<{ usuarioId: string } | Erro> {
  if (!codigoValido(codigo)) return { erro: "Placa inválida." };
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Entre na sua conta para ativar." };
  const { data } = await supabase.from("placas").select("id").eq("codigo", codigo)
    .eq("dono_id", user.id).eq("status", "atribuida").maybeSingle();
  if (!data) return { erro: "Vincule a placa à sua conta antes de ativar." };
  return { usuarioId: user.id };
}

export async function reivindicarTag(codigo: string, _anterior: string, dados: FormData) {
  const entrada = dados.get("segredo");
  const hash = typeof entrada === "string" && entrada.length <= 80 ? hashSegredoNfc(entrada) : null;
  if (!codigoValido(codigo) || !hash) return "Confira o código de ativação recebido.";
  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.rpc("speed_tag_reivindicar_nfc", { p_codigo: codigo, p_hash: hash });
  if (error?.message === "LIMITE_PLACAS") return "Sua conta atingiu o limite de placas.";
  if (error) return "Não foi possível vincular a placa agora.";
  if (!data) return "Código inválido, já utilizado ou placa indisponível para esta conta.";
  revalidatePath("/painel");
  refresh();
  return "";
}

async function ativarPlaca(codigo: string, origem: OrigemEmpresa, placeId: string | null, nome: string, link: string): Promise<ResultadoAtivacao> {
  const acesso = await placaAtivavel(codigo);
  if ("erro" in acesso) return acesso;
  const { data, error } = await clienteSupabaseServico().rpc("ativar_placa", {
    p_codigo: codigo, p_ator: acesso.usuarioId, p_origem: origem, p_place_id: placeId, p_nome: nome, p_link: link,
  });
  if (error || !data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
    return { erro: "Não foi possível ativar. Confira se a placa ainda está vinculada à sua conta." };
  }
  revalidatePath("/painel");
  revalidatePath("/painel/empresas");
  revalidatePath("/painel/inicio");
  return { ativada: true, emailEnviado: false };
}

export type { ResultadoAtivacao };

export async function ativarComEmpresaSalva(codigo: string, _anterior: string, dados: FormData) {
  const empresa = z.uuid().safeParse(dados.get("empresa"));
  if (!empresa.success) return "Escolha uma empresa da sua conta.";
  const acesso = await placaAtivavel(codigo);
  if ("erro" in acesso) return acesso.erro;

  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.rpc("speed_tag_vincular_empresa", { p_empresa: empresa.data, p_codigo: codigo });
  if (error || !data) return "Não foi possível ativar a placa para esta empresa.";
  revalidatePath("/painel");
  revalidatePath("/painel/empresas");
  revalidatePath("/painel/inicio");
  redirect(`/painel/empresas?ativada=${encodeURIComponent(codigo)}`);
}

/**
 * Quem pode buscar empresa: o dono logado da placa (cota da conta) ou qualquer visitante de
 * uma placa ainda ativável (cota por IP), porque a ativação pelo NFC não exige login.
 */
async function contextoBusca(codigo: string): Promise<{ usuarioId?: string } | Erro> {
  const logado = await placaAtivavel(codigo);
  if (!("erro" in logado)) return { usuarioId: logado.usuarioId };
  const publica = await placaAtivavelPublica(codigo);
  return "erro" in publica ? publica : {};
}

/** Token da sessão de busca do Google (UUID gerado na tela): só repassado se for válido. */
const sessaoValida = (sessao?: string) => (sessao && z.uuid().safeParse(sessao).success ? sessao : undefined);

export async function pesquisarEmpresa(codigo: string, consulta: string, sessao?: string): Promise<{ empresas: EmpresaEncontrada[] } | Erro> {
  const ctx = await contextoBusca(codigo);
  if ("erro" in ctx) return ctx;
  return pesquisarNoGoogle(consulta, { sessao: sessaoValida(sessao), usuarioId: ctx.usuarioId });
}

export async function verDetalhesEmpresa(codigo: string, placeId: string, sessao?: string): Promise<{ empresa: EmpresaGerada } | Erro> {
  const ctx = await contextoBusca(codigo);
  if ("erro" in ctx) return ctx;
  return gerarPorPlaceId(placeId, { sessao: sessaoValida(sessao), usuarioId: ctx.usuarioId });
}

/** Link do Google Maps colado pelo cliente (inclusive curto): identifica a empresa. */
export async function identificarPorLink(codigo: string, link: string): Promise<{ empresa: EmpresaGerada } | Erro> {
  const ctx = await contextoBusca(codigo);
  if ("erro" in ctx) return ctx;
  return gerarPorLink(link, { usuarioId: ctx.usuarioId });
}

/**
 * O link vem do servidor: writeAReviewUri devolvido pelo Google na confirmação, aceito só
 * se for do Google; sem ele, o formulário oficial pelo Place ID.
 */
export async function ativarComGoogle(codigo: string, placeId: string, nome: string, link?: string): Promise<ResultadoAtivacao> {
  if (!esquemaPlaceId.safeParse(placeId).success) return { erro: "Selecione uma empresa da lista." };
  const nomeLimpo = z.string().trim().min(1).max(200).safeParse(nome);
  if (!nomeLimpo.success) return { erro: "Nome da empresa inválido." };
  return ativarPlaca(codigo, "google_places", placeId, nomeLimpo.data, linkAvaliacaoSeguro(placeId, link));
}

export async function ativarComLink(codigo: string, nome: string, link: string): Promise<ResultadoAtivacao> {
  const entrada = z
    .object({ nome: z.string().trim().min(2, "Digite o nome da empresa.").max(200), link: z.string().trim().max(2048) })
    .safeParse({ nome, link });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos." };
  if (!linkGooglePermitido(entrada.data.link)) {
    return { erro: "Use o link de avaliação do Google (search.google.com, g.page ou maps.app.goo.gl)." };
  }
  return ativarPlaca(codigo, "manual", null, entrada.data.nome, entrada.data.link);
}

export type { ResultadoPedido };

/**
 * Ativação pelo NFC: vincula a empresa antes de solicitar o e-mail de acesso.
 * Empresa do Google (Place ID) ou link colado; o link final sempre é montado no servidor.
 */
export async function ativarPorEmail(
  codigo: string,
  email: string,
  empresa: { tipo: "google"; placeId: string; nome: string; link?: string } | { tipo: "manual"; nome: string; link: string },
): Promise<ResultadoPedido> {
  const nome = z.string().trim().min(2, "Digite o nome da empresa.").max(200).safeParse(empresa.nome);
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "Nome da empresa inválido." };
  if (empresa.tipo === "google") {
    if (!esquemaPlaceId.safeParse(empresa.placeId).success) return { erro: "Selecione uma empresa da lista." };
    return ativarPeloNfc({
      codigo, email, origem: "google_places", placeId: empresa.placeId, nome: nome.data,
      link: linkAvaliacaoSeguro(empresa.placeId, empresa.link),
    });
  }
  const link = z.string().trim().max(2048).safeParse(empresa.link);
  if (!link.success || !linkGooglePermitido(link.data)) {
    return { erro: "Use o link de avaliação do Google (search.google.com, g.page ou maps.app.goo.gl)." };
  }
  return ativarPeloNfc({ codigo, email, origem: "manual", placeId: null, nome: nome.data, link: link.data });
}
