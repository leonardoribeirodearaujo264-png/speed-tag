"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { caminhoInternoSeguro } from "@/lib/auth";
import { verificarCodigoEmail } from "@/lib/auth-codigo";
import { urlDoSiteParaLogin } from "@/lib/env";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

type Estado = { tipo: "inicial" } | { tipo: "enviado"; email: string } | { tipo: "erro"; mensagem: string };

export async function solicitarRecuperacao(proximo: string, _anterior: Estado, dados: FormData): Promise<Estado> {
  const email = z.email().max(254).safeParse(String(dados.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { tipo: "erro", mensagem: "Informe um e-mail válido." };

  const requisicao = await headers();
  const retorno = new URL("/auth/confirmar", urlDoSiteParaLogin(requisicao.get("host")));
  retorno.searchParams.set("recuperar", "1");
  retorno.searchParams.set("proximo", caminhoInternoSeguro(proximo, "/painel/empresas"));

  const supabase = await clienteSupabaseUsuario();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: retorno.toString() });
  if (error && error.code !== "user_not_found") {
    console.error("[recuperar-senha] solicitação", error.status, error.code);
    return { tipo: "erro", mensagem: error.status === 429
      ? "Muitas tentativas. Aguarde um pouco e tente novamente."
      : "A recuperação está indisponível agora. Tente novamente em instantes." };
  }
  return { tipo: "enviado", email: email.data };
}

export async function confirmarCodigoRecuperacao(proximo: string, email: string, _anterior: string, dados: FormData): Promise<string> {
  const resultado = await verificarCodigoEmail(email, dados.get("codigo"), "recovery");
  if ("erro" in resultado) return resultado.erro ?? "Não foi possível confirmar o código.";
  const destino = caminhoInternoSeguro(proximo, "/painel/empresas");
  redirect(`/recuperar-senha/nova?proximo=${encodeURIComponent(destino)}`);
}
