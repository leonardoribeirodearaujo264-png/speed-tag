"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { listarCodigosDoLote } from "@/lib/placas/consultas";
import { MODELOS_ARTE, NOMES_MODELOS, type ModeloArte } from "@/lib/placas/modelos-arte";
import { interpretarExclusaoLote, type ResultadoExclusaoLote } from "@/lib/placas/exclusao-lote";

export type EstadoAtribuirLote = { tipo: "inicial" } | { tipo: "sucesso"; mensagem: string } | { tipo: "erro"; mensagem: string };

const esquema = z.object({
  loteId: z.uuid(),
  email: z.email("Digite o e-mail da conta do cliente.").max(254),
  quantidade: z.coerce.number().int("Quantidade inteira.").min(1, "Mínimo de 1 placa.").max(1000, "Máximo de 1000 por vez."),
});

export async function atribuirDoLoteAcao(_anterior: EstadoAtribuirLote, dados: FormData): Promise<EstadoAtribuirLote> {
  const loteId = String(dados.get("loteId") ?? "");
  const { supabase } = await exigirAdmin(`/admin/lotes/${loteId}`);

  const entrada = esquema.safeParse({
    loteId,
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
    quantidade: dados.get("quantidade"),
  });
  if (!entrada.success) return { tipo: "erro", mensagem: entrada.error.issues[0]?.message ?? "Dados inválidos." };

  const { data: usuario } = await supabase
    .from("perfis")
    .select("id, nome, email")
    .eq("email", entrada.data.email)
    .maybeSingle();
  if (!usuario) {
    return { tipo: "erro", mensagem: "Nenhum usuário com esse e-mail. O cliente precisa ter conta no app antes de receber placas." };
  }

  const { data, error } = await supabase.rpc("admin_atribuir_do_lote", {
    p_lote: entrada.data.loteId,
    p_usuario: usuario.id,
    p_quantidade: entrada.data.quantidade,
  });
  if (error) {
    console.error("[lotes] atribuir falhou", error.code);
    return { tipo: "erro", mensagem: "Não foi possível atribuir agora. Tente de novo." };
  }

  const r = data as { ok: boolean; erro?: string; disponiveis?: number; quantidade?: number };
  if (!r.ok) {
    return {
      tipo: "erro",
      mensagem:
        r.erro === "ESTOQUE_INSUFICIENTE"
          ? `O lote só tem ${r.disponiveis ?? 0} placas em estoque.`
          : "Não foi possível atribuir. Confira os dados.",
    };
  }

  revalidatePath(`/admin/lotes/${loteId}`);
  revalidatePath("/admin/placas");
  revalidatePath("/admin");
  return { tipo: "sucesso", mensagem: `${r.quantidade} placas atribuídas a ${usuario.nome ?? usuario.email}.` };
}

/** Troca o modelo da arte do lote. Vale para prévia, PNG e folha de impressão das placas dele. */
export async function trocarModeloLoteAcao(loteId: string, modelo: string): Promise<{ ok: boolean; mensagem: string }> {
  const { supabase } = await exigirAdmin(`/admin/lotes/${loteId}`);
  if (!z.uuid().safeParse(loteId).success || !NOMES_MODELOS.includes(modelo as ModeloArte)) {
    return { ok: false, mensagem: "Modelo inválido." };
  }
  const { data, error } = await supabase
    .from("lotes")
    .update({ modelo_arte: modelo as ModeloArte })
    .eq("id", loteId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[lotes] trocar modelo", error.code);
    return {
      ok: false,
      mensagem: error.code === "PGRST204" || error.code === "42703" ? "Rode a migração 0015 no Supabase antes de trocar a arte." : "Não foi possível trocar a arte agora.",
    };
  }
  if (!data) return { ok: false, mensagem: "Lote não encontrado." };
  // Trocar a arte do lote deixa todas as placas iguais: tira a cor própria das placas (lote misto).
  const codigos = await listarCodigosDoLote(supabase, loteId);
  if (codigos?.length) {
    const { error: erroCor } = await supabase.rpc("speed_tag_definir_cor_placas", { p_codigos: codigos, p_modelo: null });
    if (erroCor && erroCor.code !== "PGRST202") {
      console.error("[lotes] limpar cor das placas", erroCor.code);
      return { ok: false, mensagem: "A arte do lote mudou, mas algumas placas mantiveram a cor própria. Tente de novo." };
    }
  }
  revalidatePath(`/admin/lotes/${loteId}`);
  return { ok: true, mensagem: `Todas as placas do lote agora usam a arte ${MODELOS_ARTE[modelo as ModeloArte].rotulo}.` };
}

/**
 * Exclui o lote e as placas dele pela função do banco (só ADM, migração 0025).
 * A regra de bloqueio (placas ativas, aguardando ativação ou com dono) é conferida de novo no banco.
 */
export async function excluirLoteAcao(loteId: string): Promise<ResultadoExclusaoLote> {
  const { supabase } = await exigirAdmin(`/admin/lotes/${loteId}`);
  if (!z.uuid().safeParse(loteId).success) return { ok: false, mensagem: "Lote inválido." };

  const { data, error } = await supabase.rpc("speed_tag_excluir_lote", { p_lote: loteId });
  if (error) {
    console.error("[lotes] excluir falhou", error.code);
    return {
      ok: false,
      mensagem: error.code === "PGRST202" ? "Rode a migração 0025 no Supabase antes de excluir lotes." : "Não foi possível excluir o lote agora. Tente de novo.",
    };
  }
  const resultado = interpretarExclusaoLote(data);
  if (!resultado.ok) return resultado;

  revalidatePath("/admin/lotes");
  revalidatePath("/admin/placas");
  revalidatePath("/admin");
  redirect(`/admin/lotes?excluido=${encodeURIComponent(resultado.nome)}&placas=${resultado.placasApagadas}`);
}
