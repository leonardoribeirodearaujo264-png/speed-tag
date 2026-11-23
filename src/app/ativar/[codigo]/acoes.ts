"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { exigeConfirmacaoEmail } from "@/lib/env";
import { linkEscreverAvaliacao, linkGooglePermitido } from "@/lib/google/dominios";
import { buscarEmpresas, detalhesEmpresa, esquemaPlaceId, type DetalhesEmpresa, type EmpresaEncontrada } from "@/lib/google/places";
import { ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import type { OrigemEmpresa } from "@/lib/supabase/tipos";

type Erro = { erro: string };

const MENSAGENS_ATIVACAO: Record<string, string> = {
  NAO_AUTENTICADO: "Entre com seu e-mail para continuar.",
  NAO_ENCONTRADA: "Placa não encontrada.",
  JA_ATIVADA: "Esta placa já foi ativada.",
  DESATIVADA: "Esta placa está desativada.",
  NAO_E_SUA: "Esta placa já pertence a outra conta ou ainda não foi liberada.",
  DADOS_INVALIDOS: "Confira o nome e o link de avaliação.",
  SEM_PERFIL: "Não foi possível preparar sua conta. Saia e entre de novo.",
};

// ---------- Conta ----------

const esquemaEmail = z.email("Digite um e-mail válido.").max(254);

/** Diz se o e-mail já tem conta (entrar) ou não (criar). Só o servidor consulta. */
export async function identificarEmail(email: string): Promise<{ tipo: "entrar" | "criar" } | Erro> {
  const entrada = esquemaEmail.safeParse(email.trim().toLowerCase());
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "E-mail inválido." };
  const { data, error } = await clienteSupabaseServico().rpc("email_tem_conta", { p_email: entrada.data });
  if (error) {
    console.error("[ativar] email_tem_conta", error.code);
    return { erro: "Não foi possível verificar o e-mail agora. Tente de novo." };
  }
  return { tipo: data ? "entrar" : "criar" };
}

export async function entrarComSenha(email: string, senha: string): Promise<{ ok: true } | Erro> {
  const entrada = z.object({ email: esquemaEmail, senha: z.string().min(1).max(200) }).safeParse({ email: email.trim().toLowerCase(), senha });
  if (!entrada.success) return { erro: "Digite o e-mail e a senha." };
  const supabase = await clienteSupabaseUsuario();
  const { error } = await supabase.auth.signInWithPassword({ email: entrada.data.email, password: entrada.data.senha });
  if (error) {
    return { erro: error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "E-mail ou senha incorretos." };
  }
  await supabase.rpc("garantir_perfil");
  return { ok: true };
}

const esquemaConta = z.object({
  nome: z.string().trim().min(2, "Digite seu nome.").max(120),
  email: esquemaEmail,
  telefone: z.string().trim().max(30).regex(/^[0-9+() -]*$/, "Telefone com caracteres inválidos."),
  senha: z.string().min(10, "A senha precisa de pelo menos 10 caracteres.").max(72),
});

export async function criarContaCliente(dados: { nome: string; email: string; telefone: string; senha: string }): Promise<{ ok: true } | Erro> {
  const entrada = esquemaConta.safeParse({ ...dados, email: dados.email.trim().toLowerCase() });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos." };
  if (exigeConfirmacaoEmail()) return { erro: "Cadastro por esta tela indisponível enquanto a confirmação de e-mail estiver ligada." };

  const servico = clienteSupabaseServico();
  const criado = await servico.auth.admin.createUser({
    email: entrada.data.email,
    password: entrada.data.senha,
    email_confirm: true,
    user_metadata: { name: entrada.data.nome },
  });
  if (criado.error) {
    console.error("[ativar] createUser", criado.error.status, criado.error.code);
    if (criado.error.code === "email_exists") return { erro: "Este e-mail já tem conta. Volte e entre com sua senha." };
    if (criado.error.code === "weak_password") return { erro: "Senha fraca. Misture letras, números e símbolos." };
    return { erro: "Não foi possível criar a conta agora." };
  }

  if (entrada.data.telefone) {
    const { error } = await servico.from("perfis").update({ telefone: entrada.data.telefone }).eq("id", criado.data.user.id);
    if (error) console.error("[ativar] telefone não salvo", error.code);
  }
  return entrarComSenha(entrada.data.email, entrada.data.senha);
}

// ---------- Placa e empresa ----------

/** Confere que quem está logado pode ativar esta placa antes de gastar chamadas no Google. */
async function autorizar(codigoBruto: string): Promise<{ codigo: string; usuarioId: string } | Erro> {
  const codigo = normalizarCodigo(codigoBruto);
  if (!codigoValido(codigo)) return { erro: "Placa inválida." };
  const supabase = await clienteSupabaseUsuario();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: MENSAGENS_ATIVACAO.NAO_AUTENTICADO };

  const { data: placa, error } = await clienteSupabaseServico()
    .from("placas")
    .select("status, dono_id, preparada_nfc, nfc_entregue_em")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) return { erro: "Não foi possível consultar a placa agora." };
  if (!placa) return { erro: MENSAGENS_ATIVACAO.NAO_ENCONTRADA };
  if (placa.status === "ativa") return { erro: MENSAGENS_ATIVACAO.JA_ATIVADA };
  if (placa.status === "desativada") return { erro: MENSAGENS_ATIVACAO.DESATIVADA };

  const livre = !placa.dono_id && placa.status === "disponivel" && (!placa.preparada_nfc || !!placa.nfc_entregue_em);
  if (placa.dono_id !== user.id && !livre) return { erro: MENSAGENS_ATIVACAO.NAO_E_SUA };
  return { codigo, usuarioId: user.id };
}

export async function pesquisarEmpresa(codigo: string, consulta: string): Promise<{ empresas: EmpresaEncontrada[] } | Erro> {
  const busca = z.string().trim().min(3).max(180).safeParse(consulta);
  if (!busca.success) return { erro: "Digite pelo menos 3 letras do nome da empresa." };
  const acesso = await autorizar(codigo);
  if ("erro" in acesso) return acesso;
  try {
    return { empresas: await buscarEmpresas(busca.data) };
  } catch (erro) {
    console.error("[ativar] busca no Google", erro instanceof Error ? erro.message : "erro");
    return { erro: "A busca no Google está indisponível agora. Use \"Não encontrou seu negócio?\"." };
  }
}

export async function verDetalhesEmpresa(codigo: string, placeId: string): Promise<{ empresa: DetalhesEmpresa } | Erro> {
  if (!esquemaPlaceId.safeParse(placeId).success) return { erro: "Selecione uma empresa da lista." };
  const acesso = await autorizar(codigo);
  if ("erro" in acesso) return acesso;
  try {
    return { empresa: await detalhesEmpresa(placeId) };
  } catch (erro) {
    console.error("[ativar] detalhes no Google", erro instanceof Error ? erro.message : "erro");
    return { erro: "Não foi possível carregar os dados da empresa. Tente de novo." };
  }
}

async function ativar(codigo: string, origem: OrigemEmpresa, placeId: string | null, nome: string, link: string) {
  const acesso = await autorizar(codigo);
  if ("erro" in acesso) return acesso;

  const { data, error } = await clienteSupabaseServico().rpc("ativar_placa_cliente", {
    p_codigo: acesso.codigo,
    p_ator: acesso.usuarioId,
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
  if (!r.ok) return { erro: MENSAGENS_ATIVACAO[r.erro ?? ""] ?? "Não foi possível ativar." };

  revalidatePath(`/ativar/${acesso.codigo}`);
  revalidatePath(`/admin/placas/${acesso.codigo}`);
  revalidatePath(`${ROTA_PREPARO_NFC}/${acesso.codigo}`);
  return { ativada: true as const };
}

/** O link vem do Place ID no servidor (formulário oficial de avaliação), nunca do navegador. */
export async function ativarComGoogle(codigo: string, placeId: string, nome: string) {
  if (!esquemaPlaceId.safeParse(placeId).success) return { erro: "Selecione uma empresa da lista." };
  const nomeLimpo = z.string().trim().min(1).max(200).safeParse(nome);
  if (!nomeLimpo.success) return { erro: "Nome da empresa inválido." };
  return ativar(codigo, "google_places", placeId, nomeLimpo.data, linkEscreverAvaliacao(placeId));
}

export async function ativarComLink(codigo: string, nome: string, link: string) {
  const entrada = z
    .object({ nome: z.string().trim().min(2, "Digite o nome da empresa.").max(200), link: z.string().trim().max(2048) })
    .safeParse({ nome, link });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos." };
  if (!linkGooglePermitido(entrada.data.link)) {
    return { erro: "Use o link de avaliação do Google (search.google.com, g.page ou maps.app.goo.gl)." };
  }
  return ativar(codigo, "manual", null, entrada.data.nome, entrada.data.link);
}
