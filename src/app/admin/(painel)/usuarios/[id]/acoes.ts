"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
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
  bloqueado: z.boolean(),
  grupo: z.enum(["revendedor", "comprador", ""]).optional().default(""),
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
    bloqueado: dados.get("bloqueado") === "on",
    grupo: dados.get("grupo") ?? undefined,
  });
  if (!entrada.success) return { tipo: "erro", mensagem: entrada.error.issues[0]?.message ?? "Dados inválidos." };

  const limite = dados.get("limite");
  const valor = limite === "" ? null : z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().max(10000)).safeParse(limite);
  if (valor && !valor.success) return { tipo: "erro", mensagem: "Informe um limite entre 0 e 10000." };

  const { data, error } = await supabase.rpc("speed_tag_editar_cliente_grupo", {
    p_usuario: entrada.data.usuarioId,
    p_nome: entrada.data.nome || null,
    p_telefone: entrada.data.telefone || null,
    p_bloqueado: entrada.data.bloqueado,
    p_limite: valor?.data ?? null,
    p_grupo: entrada.data.grupo || null,
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

export async function removerAcessoCliente(usuarioId: string, _anterior: string, dados: FormData) {
  const { supabase } = await exigirAdmin();
  if (!z.uuid().safeParse(usuarioId).success || dados.get("confirmar") !== "on") return "Confirme a remoção de acesso.";
  const { data, error } = await supabase.rpc("speed_tag_remover_acesso_cliente", { p_usuario: usuarioId });
  if (error || !data) return "Não foi possível remover o acesso deste cliente.";
  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return "Acesso removido. É possível liberar novamente na ficha do cliente.";
}

export async function transferirPlaca(usuarioId: string, _anterior: string, dados: FormData): Promise<string> {
  const { supabase } = await exigirAdmin();
  const codigo = normalizarCodigo(String(dados.get("codigo") ?? "").slice(0, 20));
  if (!z.uuid().safeParse(usuarioId).success || !codigoValido(codigo) || dados.get("confirmar") !== "on") {
    return "Confira o código e confirme a transferência.";
  }
  const { data, error } = await supabase.rpc("speed_tag_admin_transferir", { p_codigo: codigo, p_usuario: usuarioId });
  if (error?.message === "LIMITE_PLACAS") return "A conta de destino atingiu o limite de placas.";
  if (error || !data) return "Não foi possível transferir. Confira a placa e o acesso do cliente.";
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/usuarios/[id]", "page");
  revalidatePath(`/admin/placas/${codigo}`);
  revalidatePath("/painel");
  return `Placa ${codigo} vinculada ao cliente.`;
}
