"use server";

import type { EmailOtpType, User } from "@supabase/supabase-js";
import { z } from "zod";
import { caminhoInternoSeguro, destinoAposLogin } from "@/lib/auth";
import { consumirProximo } from "@/lib/auth-email/envio";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import type { ResultadoConclusaoAtivacoes } from "@/lib/supabase/tipos";

/**
 * Conclusão dos links de e-mail do Supabase Auth. Três formatos de retorno:
 * - sessao: o Supabase validou o token (uso único) e devolveu a sessão no endereço (#access_token);
 * - token_hash: validamos aqui com verifyOtp;
 * - code: links antigos (PKCE), só funcionam no navegador que pediu.
 * Depois: perfil, placas pedidas pelo NFC com este e-mail e o destino certo.
 */
export type EntradaConfirmacao =
  | { tipo: "sessao"; accessToken: string; refreshToken: string; fluxo: string | null }
  | { tipo: "token_hash"; tokenHash: string; fluxo: string }
  | { tipo: "code"; codigo: string };

export type ResultadoConfirmacao = { destino: string } | { erro: string; recuperacao: boolean };

const TIPOS_OTP: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];
const token = z.string().min(10).max(4096);

export async function finalizarConfirmacao(entrada: EntradaConfirmacao): Promise<ResultadoConfirmacao> {
  const supabase = await clienteSupabaseUsuario();
  let usuario: User | null = null;
  let recuperacao = false;
  const falha = (rec = recuperacao): ResultadoConfirmacao => ({
    erro: "O link expirou ou já foi usado. Peça um novo e-mail.",
    recuperacao: rec,
  });

  if (entrada.tipo === "sessao") {
    if (!token.safeParse(entrada.accessToken).success || !token.safeParse(entrada.refreshToken).success) return falha();
    recuperacao = entrada.fluxo === "recovery";
    const { data, error } = await supabase.auth.setSession({ access_token: entrada.accessToken, refresh_token: entrada.refreshToken });
    if (error || !data.user) {
      console.error("[auth/confirmar] setSession", error?.status, error?.code);
      return falha();
    }
    usuario = data.user;
  } else if (entrada.tipo === "token_hash") {
    if (!token.safeParse(entrada.tokenHash).success || !(TIPOS_OTP as readonly string[]).includes(entrada.fluxo)) return falha();
    recuperacao = entrada.fluxo === "recovery";
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: entrada.tokenHash, type: entrada.fluxo as EmailOtpType });
    if (error || !data.user) {
      console.error("[auth/confirmar] verifyOtp", entrada.fluxo, error?.status, error?.code);
      return falha();
    }
    usuario = data.user;
  } else {
    if (!token.safeParse(entrada.codigo).success) return falha(false);
    const { data, error } = await supabase.auth.exchangeCodeForSession(entrada.codigo);
    if (error) {
      console.error("[auth/confirmar] troca de código", error.status, error.code);
      return falha(false);
    }
    usuario = data.user;
    recuperacao = "redirectType" in data && data.redirectType === "recovery";
  }

  const { error: erroPerfil } = await supabase.rpc("garantir_perfil");
  if (erroPerfil) console.error("[auth/confirmar] garantir_perfil", erroPerfil.code);
  await completarPerfil(usuario);

  const proximo = await consumirProximo();
  if (recuperacao) return { destino: `/recuperar-senha/nova?proximo=${encodeURIComponent(proximo || "/painel/empresas")}` };

  const { error: erroReivindicar } = await supabase.rpc("reivindicar_placas");
  if (erroReivindicar) console.error("[auth/confirmar] reivindicar_placas", erroReivindicar.code);

  // Pedidos de ativação feitos pelo NFC com este e-mail entram na conta agora.
  let ativadas: string[] = [];
  const { data: conclusao, error: erroConclusao } = await supabase.rpc("speed_tag_concluir_ativacoes");
  if (erroConclusao) console.error("[auth/confirmar] concluir ativações", erroConclusao.code);
  else ativadas = (conclusao as ResultadoConclusaoAtivacoes | null)?.ativadas ?? [];

  const painel = ativadas.length
    ? `/painel/empresas?ativada=${encodeURIComponent(ativadas[0])}`
    : await destinoAposLogin(supabase, proximo);

  // Conta criada só com o e-mail (NFC ou convite): cria a senha antes de entrar no painel.
  if (usuario?.user_metadata?.senha_pendente === true) {
    return { destino: `/criar-senha?proximo=${encodeURIComponent(caminhoInternoSeguro(painel, "/painel/empresas"))}` };
  }
  return { destino: painel };
}

/** Copia nome e telefone do cadastro para o perfil, sem sobrescrever o que já existe. */
async function completarPerfil(usuario: User | null) {
  const meta = usuario?.user_metadata ?? {};
  const nome = typeof meta.nome === "string" ? meta.nome.trim().slice(0, 120) : "";
  const telefone = typeof meta.telefone === "string" ? meta.telefone.replace(/[^\d+]/g, "").slice(0, 20) : "";
  if (!usuario || (!nome && !telefone)) return;
  const servico = clienteSupabaseServico();
  const { data: perfil } = await servico.from("perfis").select("nome, telefone").eq("id", usuario.id).maybeSingle();
  if (!perfil) return;
  const mudancas: { nome?: string; telefone?: string } = {};
  if (nome && !perfil.nome) mudancas.nome = nome;
  if (telefone && !perfil.telefone) mudancas.telefone = telefone;
  if (Object.keys(mudancas).length) {
    const { error } = await servico.from("perfis").update(mudancas).eq("id", usuario.id);
    if (error) console.error("[auth/confirmar] completar perfil", error.code);
  }
}
