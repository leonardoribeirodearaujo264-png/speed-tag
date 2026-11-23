"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";

/** Só admin apaga placa (RLS placas_admin_escrita). Leituras e histórico vão junto (on delete cascade). */
export async function excluirPlacaAcao(placaId: string, codigo: string): Promise<{ erro: string } | void> {
  const { supabase } = await exigirAdmin(`/admin/placas/${codigo}`);
  if (!z.uuid().safeParse(placaId).success) return { erro: "Placa inválida." };

  const { data, error } = await supabase.from("placas").delete().eq("id", placaId).eq("codigo", codigo).select("id");
  if (error) {
    console.error("[placas] exclusão falhou", error.code);
    return { erro: "Não foi possível apagar agora. Tente de novo." };
  }
  if (!data?.length) return { erro: "Placa não encontrada ou sem permissão." };

  revalidatePath("/admin/placas");
  revalidatePath("/admin");
  redirect(`/admin/placas?apagada=${encodeURIComponent(codigo)}`);
}

// ---------- Estoque ----------

export type ResultadoEstoque = { ok: true; mensagem: string } | { ok: false; mensagem: string };

type Supabase = Awaited<ReturnType<typeof exigirAdmin>>["supabase"];

const ERROS_ESTOQUE: Record<string, string> = {
  ESTADO_INVALIDO: "A placa mudou de situação. Recarregue a página.",
  USUARIO_NAO_ENCONTRADO: "Usuário não encontrado.",
  NOTA_INVALIDA: "Escreva para quem é a reserva (até 200 caracteres).",
  QUANTIDADE_INVALIDA: "Quantidade inválida.",
  PLACA_INDISPONIVEL: "A placa não está mais em estoque. Recarregue a página.",
};

function atualizarTelas(codigo: string) {
  revalidatePath(`/admin/placas/${codigo}`);
  revalidatePath("/admin/placas");
  revalidatePath("/admin");
}

/** Converte o retorno jsonb das funções de estoque em mensagem para a tela. */
function interpretar(
  resposta: { data: unknown; error: { code?: string; message?: string } | null },
  sucesso: string,
): ResultadoEstoque {
  if (resposta.error) {
    const chave = Object.keys(ERROS_ESTOQUE).find((k) => resposta.error?.message?.includes(k));
    console.error("[estoque] falhou", resposta.error.code);
    return { ok: false, mensagem: chave ? ERROS_ESTOQUE[chave] : "Não foi possível concluir agora. Tente de novo." };
  }
  const dados = resposta.data as { ok: boolean; erro?: string };
  if (!dados?.ok) return { ok: false, mensagem: ERROS_ESTOQUE[dados?.erro ?? ""] ?? "Não foi possível concluir." };
  return { ok: true, mensagem: sucesso };
}

/** Encontra o usuário do app pelo e-mail (perfis). Não exportada: em arquivo "use server" viraria ação pública. */
async function buscarUsuarioPorEmail(supabase: Supabase, email: string) {
  const { data } = await supabase.from("perfis").select("id, nome, email").eq("email", email.trim().toLowerCase()).maybeSingle();
  return data;
}

export async function atribuirPlacaAcao(codigo: string, email: string): Promise<ResultadoEstoque> {
  const { supabase } = await exigirAdmin(`/admin/placas/${codigo}`);
  if (!z.email().safeParse(email.trim()).success) return { ok: false, mensagem: "Digite um e-mail válido." };

  const usuario = await buscarUsuarioPorEmail(supabase, email);
  if (!usuario) {
    return { ok: false, mensagem: "Nenhum usuário com esse e-mail. O cliente precisa ter conta no app antes de receber placas." };
  }
  const resultado = interpretar(
    await supabase.rpc("admin_atribuir_placas", { p_codigos: [codigo], p_usuario: usuario.id }),
    `Placa atribuída a ${usuario.nome ?? usuario.email}.`,
  );
  if (resultado.ok) atualizarTelas(codigo);
  return resultado;
}

export async function reservarPlacaAcao(placaId: string, codigo: string, nota: string): Promise<ResultadoEstoque> {
  const { supabase } = await exigirAdmin(`/admin/placas/${codigo}`);
  const resultado = interpretar(await supabase.rpc("admin_reservar_placa", { p_placa: placaId, p_nota: nota }), "Placa reservada.");
  if (resultado.ok) atualizarTelas(codigo);
  return resultado;
}

export async function liberarPlacaAcao(placaId: string, codigo: string): Promise<ResultadoEstoque> {
  const { supabase } = await exigirAdmin(`/admin/placas/${codigo}`);
  const resultado = interpretar(await supabase.rpc("admin_liberar_placa", { p_placa: placaId }), "Placa devolvida ao estoque.");
  if (resultado.ok) atualizarTelas(codigo);
  return resultado;
}

export async function desativarPlacaAcao(placaId: string, codigo: string, motivo: string): Promise<ResultadoEstoque> {
  const { supabase } = await exigirAdmin(`/admin/placas/${codigo}`);
  const resultado = interpretar(
    await supabase.rpc("admin_desativar_placa", { p_placa: placaId, p_motivo: motivo || null }),
    "Placa desativada. O NFC e o QR Code param de levar à avaliação.",
  );
  if (resultado.ok) atualizarTelas(codigo);
  return resultado;
}

export async function reativarPlacaAcao(placaId: string, codigo: string): Promise<ResultadoEstoque> {
  const { supabase } = await exigirAdmin(`/admin/placas/${codigo}`);
  const resultado = interpretar(await supabase.rpc("admin_reativar_placa", { p_placa: placaId }), "Placa reativada.");
  if (resultado.ok) atualizarTelas(codigo);
  return resultado;
}
