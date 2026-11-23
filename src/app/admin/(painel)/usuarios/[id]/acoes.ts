"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import type { ResultadoAtualizarUsuario } from "@/lib/supabase/tipos";

export type EstadoEdicaoUsuario = { tipo: "inicial" } | { tipo: "sucesso" } | { tipo: "erro"; mensagem: string };

const esquema = z.object({
  usuarioId: z.uuid(),
  nome: z.string().trim().max(120, "Nome muito longo.").optional(),
  telefone: z
    .string()
    .trim()
    .max(30, "Telefone muito longo.")
    .regex(/^[0-9+() -]*$/, "Use só números, espaço, parênteses, + e -.")
    .optional(),
  papel: z.enum(["cliente", "admin"]),
  bloqueado: z.boolean(),
});

const MENSAGENS: Record<Exclude<ResultadoAtualizarUsuario, { ok: true }>["erro"], string> = {
  NOME_LONGO: "Nome muito longo.",
  TELEFONE_INVALIDO: "Telefone inválido.",
  NAO_ENCONTRADO: "Usuário não encontrado.",
  PROPRIO_USUARIO: "Você não pode tirar o seu próprio acesso de admin nem se bloquear.",
};

export async function salvarUsuario(_anterior: EstadoEdicaoUsuario, dados: FormData): Promise<EstadoEdicaoUsuario> {
  const usuarioId = String(dados.get("usuarioId") ?? "");
  const { supabase } = await exigirAdmin(`/admin/usuarios/${usuarioId}`);

  const entrada = esquema.safeParse({
    usuarioId,
    nome: dados.get("nome") ?? undefined,
    telefone: dados.get("telefone") ?? undefined,
    papel: dados.get("papel"),
    bloqueado: dados.get("bloqueado") === "on",
  });
  if (!entrada.success) return { tipo: "erro", mensagem: entrada.error.issues[0]?.message ?? "Dados inválidos." };

  const { data, error } = await supabase.rpc("admin_atualizar_usuario", {
    p_usuario: entrada.data.usuarioId,
    p_nome: entrada.data.nome || null,
    p_telefone: entrada.data.telefone || null,
    p_papel: entrada.data.papel,
    p_bloqueado: entrada.data.bloqueado,
  });
  if (error) {
    console.error("[usuarios] admin_atualizar_usuario falhou", error.code);
    return { tipo: "erro", mensagem: "Não foi possível salvar agora. Tente de novo." };
  }
  const resultado = data as ResultadoAtualizarUsuario;
  if (!resultado.ok) return { tipo: "erro", mensagem: MENSAGENS[resultado.erro] };

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/usuarios");
  return { tipo: "sucesso" };
}
