"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";

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
