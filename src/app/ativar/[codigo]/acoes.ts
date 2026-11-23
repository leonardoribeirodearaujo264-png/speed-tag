"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { envPublico, urlDoSite } from "@/lib/env";
import { linkEscreverAvaliacao, linkGooglePermitido } from "@/lib/google/dominios";
import { buscarEmpresas, detalhesEmpresa, esquemaPlaceId, type DetalhesEmpresa, type EmpresaEncontrada } from "@/lib/google/places";
import { ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";
import type { OrigemEmpresa } from "@/lib/supabase/tipos";

/**
 * Ativação no fluxo do vídeo de referência: "Qual sua empresa?" (busca no Google ou
 * link manual), "Quase lá!" (e-mail) e ativação. Não pede senha: a conta do e-mail é
 * encontrada ou criada pelo servidor, e o acesso à plataforma vai por e-mail.
 */

type Erro = { erro: string };

const MENSAGENS: Record<string, string> = {
  NAO_ENCONTRADA: "Placa não encontrada.",
  JA_ATIVADA: "Esta placa já foi ativada.",
  DESATIVADA: "Esta placa está desativada.",
  NAO_E_SUA: "Esta placa já pertence a outra conta. Use o e-mail do dono da placa.",
  RESERVADA: "Esta placa está reservada. Fale com quem vendeu.",
  DADOS_INVALIDOS: "Confira o nome e o link de avaliação.",
  SEM_PERFIL: "Não foi possível preparar a conta deste e-mail. Tente de novo.",
};

/** Só placa em estoque ou atribuída pode buscar empresa: evita gastar a API do Google à toa. */
async function placaAtivavel(codigoBruto: string): Promise<{ codigo: string } | Erro> {
  const codigo = normalizarCodigo(codigoBruto);
  if (!codigoValido(codigo)) return { erro: "Placa inválida." };
  const { data: placa, error } = await clienteSupabaseServico().from("placas").select("status").eq("codigo", codigo).maybeSingle();
  if (error) return { erro: "Não foi possível consultar a placa agora." };
  if (!placa) return { erro: MENSAGENS.NAO_ENCONTRADA };
  if (placa.status === "ativa") return { erro: MENSAGENS.JA_ATIVADA };
  if (placa.status === "desativada") return { erro: MENSAGENS.DESATIVADA };
  if (placa.status === "reservada") return { erro: MENSAGENS.RESERVADA };
  return { codigo };
}

export async function pesquisarEmpresa(codigo: string, consulta: string): Promise<{ empresas: EmpresaEncontrada[] } | Erro> {
  const busca = z.string().trim().min(3).max(180).safeParse(consulta);
  if (!busca.success) return { erro: "Digite pelo menos 3 letras do nome da empresa." };
  const placa = await placaAtivavel(codigo);
  if ("erro" in placa) return placa;
  try {
    return { empresas: await buscarEmpresas(busca.data) };
  } catch (erro) {
    console.error("[ativar] busca no Google", erro instanceof Error ? erro.message : "erro");
    return { erro: "A busca no Google está indisponível agora. Use \"Não encontrou seu negócio?\"." };
  }
}

export async function verDetalhesEmpresa(codigo: string, placeId: string): Promise<{ empresa: DetalhesEmpresa } | Erro> {
  if (!esquemaPlaceId.safeParse(placeId).success) return { erro: "Selecione uma empresa da lista." };
  const placa = await placaAtivavel(codigo);
  if ("erro" in placa) return placa;
  try {
    return { empresa: await detalhesEmpresa(placeId) };
  } catch (erro) {
    console.error("[ativar] detalhes no Google", erro instanceof Error ? erro.message : "erro");
    return { erro: "Não foi possível carregar os dados da empresa. Tente de novo." };
  }
}

/** Encontra a conta do e-mail ou cria uma já confirmada (senha aleatória: o acesso é por link no e-mail). */
async function contaDoEmail(email: string): Promise<{ id: string; nova: boolean } | Erro> {
  const servico = clienteSupabaseServico();
  const { data: existente, error } = await servico.rpc("usuario_por_email", { p_email: email });
  if (error) {
    console.error("[ativar] usuario_por_email", error.code);
    return { erro: "Não foi possível verificar o e-mail agora. Tente de novo." };
  }
  if (existente) {
    // Conta da loja (login compartilhado) ainda sem perfil no app: cria o perfil.
    await servico.from("perfis").upsert({ id: existente, email }, { onConflict: "id", ignoreDuplicates: true });
    return { id: existente, nova: false };
  }

  const criado = await servico.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (criado.error || !criado.data.user) {
    console.error("[ativar] createUser", criado.error?.status, criado.error?.code);
    return { erro: "Não foi possível criar a conta deste e-mail. Tente de novo." };
  }
  return { id: criado.data.user.id, nova: true };
}

/** Manda o link de acesso à plataforma. Retorna se o envio foi aceito (o limite de e-mails do Supabase é baixo). */
async function enviarAcesso(email: string): Promise<boolean> {
  const env = envPublico();
  const anonimo = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const retorno = new URL("/auth/confirmar", urlDoSite());
  retorno.searchParams.set("proximo", "/");
  const { error } = await anonimo.auth.signInWithOtp({ email, options: { emailRedirectTo: retorno.toString(), shouldCreateUser: false } });
  if (error) console.error("[ativar] envio do acesso por e-mail", error.status, error.code);
  return !error;
}

export type ResultadoAtivacao = { ativada: true; emailEnviado: boolean } | Erro;

async function ativar(codigoBruto: string, emailBruto: string, origem: OrigemEmpresa, placeId: string | null, nome: string, link: string): Promise<ResultadoAtivacao> {
  const email = z.email("Digite um e-mail válido.").max(254).safeParse(emailBruto.trim().toLowerCase());
  if (!email.success) return { erro: email.error.issues[0]?.message ?? "E-mail inválido." };
  const placa = await placaAtivavel(codigoBruto);
  if ("erro" in placa) return placa;

  const conta = await contaDoEmail(email.data);
  if ("erro" in conta) return conta;

  const { data, error } = await clienteSupabaseServico().rpc("ativar_placa_cliente", {
    p_codigo: placa.codigo,
    p_ator: conta.id,
    p_origem: origem,
    p_place_id: placeId,
    p_nome: nome,
    p_link: link,
  });
  if (error) {
    console.error("[ativar] ativar_placa_cliente", error.code);
    return { erro: "Não foi possível ativar agora. Tente de novo." };
  }
  const r = data as { ok: boolean; erro?: string };
  if (!r.ok) return { erro: MENSAGENS[r.erro ?? ""] ?? "Não foi possível ativar." };

  revalidatePath(`/admin/placas/${placa.codigo}`);
  revalidatePath(`${ROTA_PREPARO_NFC}/${placa.codigo}`);
  return { ativada: true, emailEnviado: await enviarAcesso(email.data) };
}

/** O link vem do Place ID no servidor (formulário oficial de avaliação), nunca do navegador. */
export async function ativarComGoogle(codigo: string, email: string, placeId: string, nome: string): Promise<ResultadoAtivacao> {
  if (!esquemaPlaceId.safeParse(placeId).success) return { erro: "Selecione uma empresa da lista." };
  const nomeLimpo = z.string().trim().min(1).max(200).safeParse(nome);
  if (!nomeLimpo.success) return { erro: "Nome da empresa inválido." };
  return ativar(codigo, email, "google_places", placeId, nomeLimpo.data, linkEscreverAvaliacao(placeId));
}

export async function ativarComLink(codigo: string, email: string, nome: string, link: string): Promise<ResultadoAtivacao> {
  const entrada = z
    .object({ nome: z.string().trim().min(2, "Digite o nome da empresa.").max(200), link: z.string().trim().max(2048) })
    .safeParse({ nome, link });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos." };
  if (!linkGooglePermitido(entrada.data.link)) {
    return { erro: "Use o link de avaliação do Google (search.google.com, g.page ou maps.app.goo.gl)." };
  }
  return ativar(codigo, email, "manual", null, entrada.data.nome, entrada.data.link);
}
