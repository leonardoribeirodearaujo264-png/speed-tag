"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { clienteAuthAnonimo, mensagemErroEnvio, registrarEnvio, urlRetornoAuth } from "@/lib/auth-email/envio";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";

export type ResultadoReenvio = { ok: boolean; mensagem: string };

/**
 * Reenvia o e-mail de ativação de um cadastro incompleto:
 * - e-mail não confirmado: o e-mail de confirmação de cadastro (Supabase Auth);
 * - confirmado sem senha: o link de acesso, que leva a criar a senha.
 * Limite de 3 reenvios por hora por e-mail, além do limite do próprio Supabase.
 */
export async function reenviarAtivacao(usuarioId: string): Promise<ResultadoReenvio> {
  await exigirAdmin("/admin/cadastros");
  if (!z.uuid().safeParse(usuarioId).success) return { ok: false, mensagem: "Cadastro inválido." };

  const servico = clienteSupabaseServico();
  const { data, error } = await servico.auth.admin.getUserById(usuarioId);
  const usuario = data?.user;
  if (error || !usuario?.email) return { ok: false, mensagem: "Cadastro não encontrado." };
  const email = usuario.email.toLowerCase();
  const confirmado = !!usuario.email_confirmed_at;
  if (confirmado && usuario.user_metadata?.senha_pendente !== true) {
    return { ok: false, mensagem: "Este cadastro já está concluído." };
  }
  if (!(await registrarEnvio(email, "reenvio_admin"))) {
    return { ok: false, mensagem: "Limite de reenvios atingido para este e-mail. Tente de novo em uma hora." };
  }

  const auth = clienteAuthAnonimo().auth;
  const retorno = await urlRetornoAuth();
  const { error: erroEnvio } = confirmado
    ? await auth.signInWithOtp({ email, options: { emailRedirectTo: retorno, shouldCreateUser: false } })
    : await auth.resend({ type: "signup", email, options: { emailRedirectTo: retorno } });
  if (erroEnvio) {
    console.error("[admin/cadastros] reenvio", erroEnvio.status, erroEnvio.code);
    return { ok: false, mensagem: mensagemErroEnvio(erroEnvio.status) };
  }

  // O link novo vale por mais 48 h também para os pedidos de placa deste e-mail.
  const { error: erroPrazo } = await servico.from("speed_tag_ativacoes_pendentes")
    .update({ expira_em: new Date(Date.now() + 48 * 3600 * 1000).toISOString() })
    .eq("email", email).is("concluida_em", null);
  if (erroPrazo) console.error("[admin/cadastros] prazo dos pedidos", erroPrazo.code);

  revalidatePath("/admin/cadastros");
  return { ok: true, mensagem: `E-mail reenviado para ${email}.` };
}
