"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { caminhoInternoSeguro } from "@/lib/auth";
import { verificarCodigoEmail } from "@/lib/auth-codigo";
import { urlDoSiteParaLogin } from "@/lib/env";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export async function cadastrarCliente(proximo: string, _anterior: { erro?: string; pendente?: boolean }, dados: FormData) {
  const entrada = z.object({ email: z.email().max(254), password: z.string().min(10).max(72) }).safeParse({
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
    password: dados.get("senha"),
  });
  if (!entrada.success) return { erro: "Informe um e-mail válido e uma senha de 10 a 72 caracteres." };

  const destino = caminhoInternoSeguro(proximo, "/painel/empresas");
  const retorno = new URL("/auth/confirmar", urlDoSiteParaLogin((await headers()).get("host")));
  retorno.searchParams.set("proximo", destino);
  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.auth.signUp({
    ...entrada.data,
    options: { emailRedirectTo: retorno.toString() },
  });
  if (error) {
    console.error("[cadastro] signUp falhou", error.status, error.code);
    return { erro: "Não foi possível concluir o cadastro. Se já tem conta, volte ao login." };
  }
  if (!data.session) return { pendente: true };
  const perfil = await supabase.rpc("garantir_perfil");
  if (perfil.error) return { erro: "A conta foi criada. Volte ao login para abrir seu painel." };
  redirect(destino);
}

export async function entrarComSenha(proximo: string, _anterior: string, dados: FormData): Promise<string> {
  const entrada = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) }).safeParse({
    email: String(dados.get("email") ?? "").trim().toLowerCase(), password: dados.get("senha"),
  });
  if (!entrada.success) return "Informe o e-mail e a senha da sua conta.";

  const supabase = await clienteSupabaseUsuario();
  const { error } = await supabase.auth.signInWithPassword(entrada.data);
  if (error) return error.status === 429 ? "Muitas tentativas. Tente novamente em instantes." : "E-mail ou senha incorretos.";

  const perfil = await supabase.rpc("garantir_perfil");
  if (perfil.error) return "Não foi possível abrir sua conta. Tente novamente.";
  const { error: erroVinculo } = await supabase.rpc("reivindicar_placas");
  if (erroVinculo) console.error("[entrar] reivindicar_placas", erroVinculo.code);
  redirect(caminhoInternoSeguro(proximo, "/painel/empresas"));
}

export async function entrarComCodigo(proximo: string, email: string, _anterior: string, dados: FormData): Promise<string> {
  const resultado = await verificarCodigoEmail(email, dados.get("codigo"), "email");
  if ("erro" in resultado) return resultado.erro ?? "Não foi possível confirmar o código.";
  const { error } = await resultado.supabase.rpc("reivindicar_placas");
  if (error) console.error("[entrar] reivindicar_placas", error.code);
  redirect(caminhoInternoSeguro(proximo, "/painel/empresas"));
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

  const proximo = caminhoInternoSeguro(entrada.data.proximo, "/painel/empresas");
  const requisicao = await headers();
  const retorno = new URL("/auth/confirmar", urlDoSiteParaLogin(requisicao.get("host")));
  retorno.searchParams.set("proximo", proximo);

  const supabase = await clienteSupabaseUsuario();
  const { error } = await supabase.auth.signInWithOtp({
    email: entrada.data.email,
    options: { emailRedirectTo: retorno.toString(), shouldCreateUser: true },
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
