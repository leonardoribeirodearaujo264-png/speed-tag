"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { criarPlacaUnica } from "@/lib/placas/criacao";

export type EstadoNovaPlaca = { erro: string | null };

const esquema = z.object({ lote: z.union([z.uuid(), z.literal("")]) });

export async function criarPlacaAcao(_anterior: EstadoNovaPlaca, dados: FormData): Promise<EstadoNovaPlaca> {
  const { supabase } = await exigirAdmin("/admin/placas/nova");

  const entrada = esquema.safeParse({ lote: dados.get("lote") ?? "" });
  if (!entrada.success) return { erro: "Lote inválido." };

  const resultado = await criarPlacaUnica(supabase, entrada.data.lote || null);
  if (!resultado.ok) return { erro: resultado.mensagem };

  redirect(`/admin/placas/${resultado.dado.codigo}?criada=1`);
}
