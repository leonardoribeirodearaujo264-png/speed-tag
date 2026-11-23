"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { caminhoInternoSeguro } from "@/lib/auth";
import { urlDoSiteParaLogin } from "@/lib/env";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

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
