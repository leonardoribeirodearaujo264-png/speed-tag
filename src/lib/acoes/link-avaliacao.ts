"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { gerarPorLink, gerarPorPlaceId, pesquisarNoGoogle, type EmpresaGerada } from "@/lib/google/gerador";
import { verificarLinkAvaliacao, type VerificacaoLink } from "@/lib/google/links-maps";
import { esquemaPlaceId, linkAvaliacaoSeguro, type EmpresaEncontrada } from "@/lib/google/places";
import { ativarPlaca } from "@/lib/placas/ativacao";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

/**
 * Ações do gerador de link de avaliação, usadas pelo painel do cliente e pelo admin.
 * Todas exigem login. Quem pode mexer em qual placa é decidido no banco: trocar_destino
 * só aceita o dono ou um admin, e a ativação por e-mail só é liberada para admin.
 */

type Erro = { erro: string };
export type ResultadoVinculo = { ok: boolean; mensagem: string };

/** O que a tela manda para vincular. O link do Google só é aceito se passar na lista de domínios. */
export type Vinculo =
  | { tipo: "google"; placeId: string; nome: string; link?: string }
  | { tipo: "manual"; nome: string; link: string };

async function usuarioLogado() {
  const supabase = await clienteSupabaseUsuario();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: liberado } = await supabase.rpc("speed_tag_acesso_cliente");
  return liberado ? { supabase, usuarioId: user.id } : null;
}

const SEM_LOGIN: Erro = { erro: "Sua sessão expirou. Entre de novo." };

export async function pesquisarEmpresas(consulta: string): Promise<{ empresas: EmpresaEncontrada[] } | Erro> {
  const sessao = await usuarioLogado();
  if (!sessao) return SEM_LOGIN;
  return pesquisarNoGoogle(consulta, { usuarioId: sessao.usuarioId });
}

/** Gera o link de avaliação a partir de uma empresa escolhida na busca ou de um link colado do Maps. */
export async function gerarLinkAvaliacao(entrada: { placeId: string } | { link: string }): Promise<{ empresa: EmpresaGerada } | Erro> {
  const sessao = await usuarioLogado();
  if (!sessao) return SEM_LOGIN;
  const ctx = { usuarioId: sessao.usuarioId };
  return "placeId" in entrada ? gerarPorPlaceId(entrada.placeId, ctx) : gerarPorLink(entrada.link, ctx);
}

/** Testa no servidor se o link final responde pelo Google (o teste de verdade é abrir no celular). */
export async function testarLinkAvaliacao(link: string): Promise<VerificacaoLink> {
  const sessao = await usuarioLogado();
  if (!sessao) return { estado: "nao_verificado", detalhe: SEM_LOGIN.erro };
  if (!linkGooglePermitido(link.trim())) return { estado: "invalido", detalhe: "Use um link de avaliação do Google." };
  return verificarLinkAvaliacao(link.trim());
}

type DadosVinculo = { origem: "google_places" | "manual"; placeId: string | null; nome: string; link: string };

function lerVinculo(v: Vinculo): DadosVinculo | Erro {
  const nome = z.string().trim().min(1, "Informe o nome da empresa.").max(200, "Nome muito longo.").safeParse(v.nome);
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "Nome inválido." };
  if (v.tipo === "google") {
    if (!esquemaPlaceId.safeParse(v.placeId).success) return { erro: "Selecione uma empresa da lista." };
    return { origem: "google_places", placeId: v.placeId, nome: nome.data, link: linkAvaliacaoSeguro(v.placeId, v.link) };
  }
  const link = v.link.trim();
  if (!linkGooglePermitido(link)) return { erro: "Use um link de avaliação do Google (g.page, maps.app.goo.gl ou search.google.com)." };
  return { origem: "manual", placeId: null, nome: nome.data, link };
}

function atualizarTelas(codigo: string) {
  revalidatePath(`/admin/placas/${codigo}`);
  revalidatePath("/admin/placas");
  revalidatePath("/painel");
}

/**
 * Vincula o link à placa ativa (troca o destino). A tag NFC não precisa ser regravada:
 * ela aponta para /t/CODIGO, e o destino muda só no banco.
 */
export async function vincularLinkAPlaca(codigoBruto: string, vinculo: Vinculo): Promise<ResultadoVinculo> {
  const sessao = await usuarioLogado();
  if (!sessao) return { ok: false, mensagem: SEM_LOGIN.erro };
  const codigo = normalizarCodigo(codigoBruto);
  if (!codigoValido(codigo)) return { ok: false, mensagem: "Placa inválida." };
  const dados = lerVinculo(vinculo);
  if ("erro" in dados) return { ok: false, mensagem: dados.erro };

  const teste = await verificarLinkAvaliacao(dados.link);
  if (teste.estado === "invalido") return { ok: false, mensagem: `O link não funciona: ${teste.detalhe}` };

  // RLS: o cliente só enxerga as próprias placas; o admin, todas.
  const { data: placa } = await sessao.supabase.from("placas").select("id").eq("codigo", codigo).maybeSingle();
  if (!placa) return { ok: false, mensagem: "Placa não encontrada." };

  const { data, error } = await sessao.supabase.rpc("trocar_destino", {
    p_placa_id: placa.id,
    p_origem: dados.origem,
    p_place_id: dados.placeId,
    p_nome: dados.nome,
    p_link: dados.link,
  });
  if (error) {
    console.error("[vincular] trocar_destino", error.code);
    return { ok: false, mensagem: "Não foi possível salvar agora. Tente de novo." };
  }
  const r = data as { ok: boolean; erro?: string };
  if (!r.ok) {
    const mensagens: Record<string, string> = {
      PLACA_NAO_ATIVA: "Esta placa ainda não foi ativada.",
      NAO_ENCONTRADA: "Placa não encontrada.",
      DADOS_INVALIDOS: "Confira o nome e o link.",
    };
    return { ok: false, mensagem: mensagens[r.erro ?? ""] ?? "Não foi possível salvar." };
  }
  atualizarTelas(codigo);
  return { ok: true, mensagem: `Placa ${codigo} agora leva à avaliação de ${dados.nome}.` };
}

/** Só admin: ativa uma placa ainda não ativa para o cliente do e-mail, já com o link. */
export async function ativarPlacaPeloAdmin(codigoBruto: string, email: string, vinculo: Vinculo): Promise<ResultadoVinculo> {
  const sessao = await usuarioLogado();
  if (!sessao) return { ok: false, mensagem: SEM_LOGIN.erro };
  const { data: admin } = await sessao.supabase.rpc("eh_admin");
  if (admin !== true) return { ok: false, mensagem: "Só administradores podem ativar por aqui." };
  const dados = lerVinculo(vinculo);
  if ("erro" in dados) return { ok: false, mensagem: dados.erro };

  const r = await ativarPlaca(codigoBruto, email, dados.origem, dados.placeId, dados.nome, dados.link);
  if ("erro" in r) return { ok: false, mensagem: r.erro };
  atualizarTelas(normalizarCodigo(codigoBruto));
  return {
    ok: true,
    mensagem: r.emailEnviado ? "Placa ativada. O cliente recebeu o acesso por e-mail." : "Placa ativada. O e-mail de acesso não saiu agora (limite do Supabase).",
  };
}
