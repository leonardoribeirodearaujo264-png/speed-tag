"use server";

import { z } from "zod";
import { caminhoInternoSeguro } from "@/lib/auth";
import { urlDoSite } from "@/lib/env";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

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

  const proximo = caminhoInternoSeguro(entrada.data.proximo, "/painel");
  const retorno = new URL("/auth/confirmar", urlDoSite());
  retorno.searchParams.set("proximo", proximo);

  const supabase = await clienteSupabaseUsuario();
  const { error } = await supabase.auth.signInWithOtp({
    email: entrada.data.email,
    options: { emailRedirectTo: retorno.toString() },
  });

  if (error) {
    // 429 = limite de envio do Supabase; o resto vai como erro genérico.
    const mensagem =
      error.status === 429
        ? "Muitas tentativas. Aguarde um minuto e tente de novo."
        : "Não foi possível enviar o link agora. Tente de novo em instantes.";
    console.error("[entrar] signInWithOtp falhou", error.status, error.code);
    return { tipo: "erro", mensagem };
  }

  return { tipo: "enviado", email: entrada.data.email };
}
