import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { envPublico, urlDoSite } from "@/lib/env";
import { verificarLinkAvaliacao } from "@/lib/google/links-maps";
import { ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";
import type { OrigemEmpresa } from "@/lib/supabase/tipos";

/**
 * Núcleo da ativação, usado pela tela pública /ativar e pelo admin: encontra ou cria a
 * conta do e-mail, testa o link, ativa no banco e manda o acesso por e-mail.
 */

export type Erro = { erro: string };

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
export async function placaAtivavel(codigoBruto: string): Promise<{ codigo: string } | Erro> {
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

/** Encontra a conta do e-mail ou cria uma já confirmada (senha aleatória: o acesso é por link no e-mail). */
export async function contaDoEmail(email: string): Promise<{ id: string; nova: boolean } | Erro> {
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
  retorno.searchParams.set("proximo", "/painel");
  const { error } = await anonimo.auth.signInWithOtp({ email, options: { emailRedirectTo: retorno.toString(), shouldCreateUser: false } });
  if (error) console.error("[ativar] envio do acesso por e-mail", error.status, error.code);
  return !error;
}

export type ResultadoAtivacao = { ativada: true; emailEnviado: boolean } | Erro;

export async function ativarPlaca(codigoBruto: string, emailBruto: string, origem: OrigemEmpresa, placeId: string | null, nome: string, link: string): Promise<ResultadoAtivacao> {
  const email = z.email("Digite um e-mail válido.").max(254).safeParse(emailBruto.trim().toLowerCase());
  if (!email.success) return { erro: email.error.issues[0]?.message ?? "E-mail inválido." };
  const placa = await placaAtivavel(codigoBruto);
  if ("erro" in placa) return placa;

  // Testa o link final antes de ativar: só recusa o que com certeza não funciona.
  const teste = await verificarLinkAvaliacao(link);
  if (teste.estado === "invalido") return { erro: `O link de avaliação não funciona: ${teste.detalhe}` };

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
