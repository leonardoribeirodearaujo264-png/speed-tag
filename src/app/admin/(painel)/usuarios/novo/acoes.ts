"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";
import type { ResultadoDefinirAdmin } from "@/lib/supabase/tipos";

export type EstadoNovoUsuario = { erro: string | null; campos: { nome: string; email: string; telefone: string } };

const esquema = z.object({
  nome: z.string().trim().min(2, "Digite o nome.").max(120),
  email: z.email("Digite um e-mail válido.").max(254),
  telefone: z.string().trim().max(30).regex(/^[0-9+() -]*$/, "Telefone com caracteres inválidos."),
  senha: z.string().min(10, "A senha inicial precisa de pelo menos 10 caracteres.").max(72),
});

/**
 * Cria a conta de um cliente já confirmada (secret key, só no servidor).
 * Se o e-mail já tem conta (login compartilhado com a loja), só inclui a pessoa no app
 * como cliente, sem mexer na senha dela.
 */
export async function criarUsuarioAcao(_anterior: EstadoNovoUsuario, dados: FormData): Promise<EstadoNovoUsuario> {
  const { supabase } = await exigirAdmin("/admin/usuarios/novo");
  const campos = {
    nome: String(dados.get("nome") ?? "").trim(),
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
    telefone: String(dados.get("telefone") ?? "").trim(),
  };
  const entrada = esquema.safeParse({ ...campos, senha: dados.get("senha") });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos.", campos };
  const { nome, email, telefone, senha } = entrada.data;

  const { data: existente } = await supabase.from("perfis").select("id").eq("email", email).maybeSingle();
  if (existente) redirect(`/admin/usuarios/${existente.id}?ja_existia=1`);

  let servico;
  try {
    servico = clienteSupabaseServico();
  } catch {
    return { erro: "Falta configurar SUPABASE_SECRET_KEY no servidor.", campos };
  }

  let usuarioId: string | null = null;
  const criado = await servico.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { name: nome },
  });

  if (criado.data.user) {
    usuarioId = criado.data.user.id;
  } else if (criado.error?.code === "email_exists") {
    // Conta já existe no login compartilhado: inclui no app como cliente.
    const { data, error } = await supabase.rpc("definir_admin", { p_email: email, p_admin: false });
    const r = data as ResultadoDefinirAdmin | null;
    if (error || !r?.ok) return { erro: "Não foi possível incluir este e-mail no app.", campos };
    usuarioId = r.usuario_id;
  } else {
    console.error("[usuarios] createUser falhou", criado.error?.status, criado.error?.code);
    return {
      erro: criado.error?.code === "weak_password" ? "Senha fraca. Misture letras, números e símbolos." : "Não foi possível criar a conta agora.",
      campos,
    };
  }

  const { error } = await supabase.rpc("admin_atualizar_usuario", {
    p_usuario: usuarioId,
    p_nome: nome,
    p_telefone: telefone || null,
    p_papel: "cliente",
    p_bloqueado: false,
  });
  if (error) console.error("[usuarios] dados iniciais não salvos", error.code);

  redirect(`/admin/usuarios/${usuarioId}?criado=${criado.data.user ? "novo" : "existente"}`);
}
