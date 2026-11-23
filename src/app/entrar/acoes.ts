"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { destinoAposLogin } from "@/lib/auth";
import { verificarCodigoEmail } from "@/lib/auth-codigo";
import { clienteAuthAnonimo, lembrarProximo, registrarEnvio, urlRetornoAuth } from "@/lib/auth-email/envio";
import { validarSenha } from "@/lib/auth-email/regras-senha";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { COOKIE_SESSAO_TEMPORARIA } from "@/lib/supabase/sessao";

export type EstadoCadastro = { erro?: string; pendente?: boolean; email?: string };

const esquemaCadastro = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Nome muito longo."),
  email: z.email("Informe um e-mail válido.").max(254),
  telefone: z.string().transform((v) => v.replace(/\D/g, "")).pipe(
    z.string().regex(/^(55)?\d{10,11}$/, "Informe um telefone com DDD."),
  ),
  termos: z.literal("on", { error: "Aceite os termos de uso e a política de privacidade." }),
});

/** Cadastro convencional: conta com senha no Supabase Auth e confirmação por e-mail. */
export async function cadastrarCliente(proximo: string, _anterior: EstadoCadastro, dados: FormData): Promise<EstadoCadastro> {
  const entrada = esquemaCadastro.safeParse({
    nome: dados.get("nome") ?? "",
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
    telefone: String(dados.get("telefone") ?? ""),
    termos: dados.get("termos"),
  });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Confira os dados." };
  const senha = String(dados.get("senha") ?? "");
  const problema = validarSenha(senha, String(dados.get("confirmacao") ?? ""));
  if (problema) return { erro: problema };

  if (!(await registrarEnvio(entrada.data.email, "cadastro"))) {
    return { erro: "Muitas tentativas com este e-mail. Aguarde e tente de novo mais tarde." };
  }
  await lembrarProximo(proximo);
  // Sem PKCE: o link do e-mail funciona em qualquer navegador (/auth/confirmar grava a sessão).
  const { data, error } = await clienteAuthAnonimo().auth.signUp({
    email: entrada.data.email,
    password: senha,
    options: {
      emailRedirectTo: await urlRetornoAuth(),
      data: { nome: entrada.data.nome, telefone: entrada.data.telefone, origem_cadastro: "site", termos_aceitos_em: new Date().toISOString() },
    },
  });
  if (error) {
    console.error("[cadastro] signUp falhou", error.status, error.code);
    return {
      erro: error.code === "weak_password"
        ? "Senha fraca. Misture letras, números e símbolos."
        : error.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente de novo." : "Não foi possível concluir o cadastro agora. Tente de novo.",
    };
  }
  // Com confirmação de e-mail ligada não há sessão: o cliente confirma pelo link.
  // E-mail já cadastrado recebe a mesma resposta (o Supabase não revela quem tem conta).
  if (!data.session) return { pendente: true, email: entrada.data.email };
  // Confirmação desligada no Supabase: já entra.
  const supabase = await clienteSupabaseUsuario();
  await supabase.auth.setSession(data.session);
  await supabase.rpc("garantir_perfil");
  redirect(await destinoAposLogin(supabase, proximo));
}

export async function entrarComSenha(proximo: string, _anterior: string, dados: FormData): Promise<string> {
  const entrada = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) }).safeParse({
    email: String(dados.get("email") ?? "").trim().toLowerCase(), password: dados.get("senha"),
  });
  if (!entrada.success) return "Informe o e-mail e a senha da sua conta.";

  // Sem "Lembrar de mim", a sessão vale até fechar o navegador (marcador lido ao gravar os cookies).
  const loja = await cookies();
  if (dados.get("lembrar") === "on") loja.delete(COOKIE_SESSAO_TEMPORARIA);
  else loja.set(COOKIE_SESSAO_TEMPORARIA, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });

  const supabase = await clienteSupabaseUsuario();
  const { error } = await supabase.auth.signInWithPassword(entrada.data);
  if (error) {
    if (error.code === "email_not_confirmed") return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    return error.status === 429 ? "Muitas tentativas. Tente novamente em instantes." : "E-mail ou senha incorretos.";
  }

  const perfil = await supabase.rpc("garantir_perfil");
  if (perfil.error) return "Não foi possível abrir sua conta. Tente novamente.";
  const { error: erroVinculo } = await supabase.rpc("reivindicar_placas");
  if (erroVinculo) console.error("[entrar] reivindicar_placas", erroVinculo.code);
  redirect(await destinoAposLogin(supabase, proximo));
}

export async function entrarComCodigo(proximo: string, email: string, _anterior: string, dados: FormData): Promise<string> {
  const resultado = await verificarCodigoEmail(email, dados.get("codigo"), "email");
  if ("erro" in resultado) return resultado.erro ?? "Não foi possível confirmar o código.";
  const { error } = await resultado.supabase.rpc("reivindicar_placas");
  if (error) console.error("[entrar] reivindicar_placas", error.code);
  redirect(await destinoAposLogin(resultado.supabase, proximo));
}

export type EstadoEntrar =
  | { tipo: "inicial" }
  | { tipo: "enviado"; email: string }
  | { tipo: "erro"; mensagem: string };

const esquema = z.object({
  email: z.email("Digite um e-mail válido.").max(254),
  proximo: z.string().optional(),
});

export async function enviarLinkMagico(_anterior: EstadoEntrar, dados: FormData): Promise<EstadoEntrar> {
  const entrada = esquema.safeParse({
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
    proximo: dados.get("proximo") ?? undefined,
  });
  if (!entrada.success) {
    return { tipo: "erro", mensagem: entrada.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await lembrarProximo(entrada.data.proximo);
  // Só entra quem já tem conta: o cadastro tem página própria (/cadastro) e a placa, o NFC.
  const { error } = await clienteAuthAnonimo().auth.signInWithOtp({
    email: entrada.data.email,
    options: { emailRedirectTo: await urlRetornoAuth(), shouldCreateUser: false },
  });

  if (error) {
    // 429 = limite de envio do Supabase; o resto vai como erro genérico.
    const mensagem =
      error.status === 429
        ? "Muitas tentativas. Aguarde um minuto e tente de novo."
        : "O link não pôde ser enviado agora. Se você já tem uma senha, use o formulário de login acima.";
    console.error("[entrar] signInWithOtp falhou", error.status, error.code);
    return { tipo: "erro", mensagem };
  }

  return { tipo: "enviado", email: entrada.data.email };
}
