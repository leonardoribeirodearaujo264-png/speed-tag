"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { caminhoInternoSeguro } from "@/lib/auth";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export type EstadoEntrarAdmin = { erro: string | null; email: string };

const esquema = z.object({
  email: z.email("Digite um e-mail válido.").max(254),
  senha: z.string().min(1, "Digite a senha.").max(200),
  proximo: z.string().optional(),
});

export async function entrarAdmin(_anterior: EstadoEntrarAdmin, dados: FormData): Promise<EstadoEntrarAdmin> {
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const entrada = esquema.safeParse({ email, senha: dados.get("senha"), proximo: dados.get("proximo") ?? undefined });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos.", email };

  const supabase = await clienteSupabaseUsuario();
  const { error } = await supabase.auth.signInWithPassword({ email: entrada.data.email, password: entrada.data.senha });

  if (error) {
    // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta.
    const mensagem =
      error.status === 429
        ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
        : error.code === "email_not_confirmed"
          ? "Confirme seu e-mail pelo link que enviamos antes de entrar."
          : "E-mail ou senha incorretos.";
    return { erro: mensagem, email };
  }

  await supabase.rpc("garantir_perfil");
  const { data: admin } = await supabase.rpc("eh_admin");

  // Conta sem acesso de admin vai para a tela de aprovação, que registra o pedido.
  if (admin !== true) redirect("/admin/aguardando");

  const destino = caminhoInternoSeguro(entrada.data.proximo, "/admin/placas");
  redirect(destino.startsWith("/admin") ? destino : "/admin/placas");
}
