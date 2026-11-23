"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { envPublico, exigeConfirmacaoEmail } from "@/lib/env";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export type EstadoRegistro =
  | { tipo: "inicial" }
  | { tipo: "confirmar_email"; email: string }
  | { tipo: "erro"; mensagem: string; campos: { nome: string; email: string } };

const esquema = z
  .object({
    nome: z.string().trim().min(2, "Digite seu nome.").max(120, "Nome muito longo."),
    email: z.email("Digite um e-mail válido.").max(254),
    senha: z.string().min(10, "A senha precisa de pelo menos 10 caracteres.").max(72, "Senha muito longa."),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { message: "As senhas não conferem.", path: ["confirmacao"] });

export async function registrarAdmin(_anterior: EstadoRegistro, dados: FormData): Promise<EstadoRegistro> {
  const campos = {
    nome: String(dados.get("nome") ?? "").trim(),
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
  };
  const entrada = esquema.safeParse({ ...campos, senha: dados.get("senha"), confirmacao: dados.get("confirmacao") });
  if (!entrada.success) {
    return { tipo: "erro", mensagem: entrada.error.issues[0]?.message ?? "Dados inválidos.", campos };
  }

  const supabase = await clienteSupabaseUsuario();

  if (!exigeConfirmacaoEmail()) {
    return registrarSemConfirmacao(supabase, { ...entrada.data, campos });
  }

  const retorno = new URL("/auth/confirmar", envPublico().NEXT_PUBLIC_SITE_URL);
  retorno.searchParams.set("proximo", "/admin/aguardando");

  const { data, error } = await supabase.auth.signUp({
    email: entrada.data.email,
    password: entrada.data.senha,
    options: { emailRedirectTo: retorno.toString(), data: { name: entrada.data.nome } },
  });

  if (error) {
    console.error("[registrar] signUp falhou", error.status, error.code);
    const mensagem =
      error.code === "weak_password"
        ? "Senha fraca. Misture letras, números e símbolos."
        : error.status === 429 || error.code === "over_email_send_rate_limit"
          ? "Limite de envio de e-mails atingido. Tente de novo em alguns minutos."
          : "Não foi possível criar a conta agora. Tente de novo.";
    return { tipo: "erro", mensagem, campos };
  }

  // Projeto sem confirmação de e-mail: já entra logado e vai pedir aprovação.
  if (data.session) redirect("/admin/aguardando");

  // Com confirmação ligada (padrão). Se o e-mail já existia, o Supabase responde
  // igual de propósito, para não revelar quem tem conta.
  return { tipo: "confirmar_email", email: entrada.data.email };
}

/**
 * Sem e-mail de confirmação: o servidor cria a conta já confirmada (secret key)
 * e entra com ela. O acesso ao painel continua dependendo da aprovação de um admin.
 */
async function registrarSemConfirmacao(
  supabase: Awaited<ReturnType<typeof clienteSupabaseUsuario>>,
  dados: { nome: string; email: string; senha: string; campos: { nome: string; email: string } },
): Promise<EstadoRegistro> {
  let servico;
  try {
    servico = clienteSupabaseServico();
  } catch {
    return {
      tipo: "erro",
      mensagem: "Cadastro indisponível: falta configurar SUPABASE_SECRET_KEY no servidor.",
      campos: dados.campos,
    };
  }

  const criado = await servico.auth.admin.createUser({
    email: dados.email,
    password: dados.senha,
    email_confirm: true,
    user_metadata: { name: dados.nome },
  });

  if (criado.error) {
    console.error("[registrar] createUser falhou", criado.error.status, criado.error.code);
    const mensagem =
      criado.error.code === "email_exists"
        ? "Este e-mail já tem conta. Entre pela tela de login."
        : criado.error.code === "weak_password"
          ? "Senha fraca. Misture letras, números e símbolos."
          : "Não foi possível criar a conta agora. Tente de novo.";
    return { tipo: "erro", mensagem, campos: dados.campos };
  }

  const { error } = await supabase.auth.signInWithPassword({ email: dados.email, password: dados.senha });
  if (error) {
    console.error("[registrar] login após criar falhou", error.status, error.code);
    return { tipo: "erro", mensagem: "Conta criada. Entre pela tela de login.", campos: dados.campos };
  }

  redirect("/admin/aguardando");
}
