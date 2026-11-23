"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";

const esquema = z.object({ placaId: z.uuid(), travado: z.boolean() });

export type ResultadoRegistroNfc = { ok: true } | { ok: false; mensagem: string };

/** Chamado depois que o chip foi gravado e conferido por leitura (ou travado). */
export async function registrarNfcAcao(entrada: { placaId: string; travado: boolean }): Promise<ResultadoRegistroNfc> {
  const { supabase } = await exigirAdmin();
  const dados = esquema.safeParse(entrada);
  if (!dados.success) return { ok: false, mensagem: "Dados inválidos." };

  const { data, error } = await supabase.rpc("registrar_nfc", {
    p_placa_id: dados.data.placaId,
    p_travado: dados.data.travado,
  });
  if (error || !data) {
    console.error("[nfc] registrar_nfc falhou", error?.code);
    return { ok: false, mensagem: "O chip foi gravado, mas não consegui registrar no sistema. Tente registrar de novo." };
  }

  revalidatePath(`/admin/placas/${data.codigo}`);
  return { ok: true };
}
