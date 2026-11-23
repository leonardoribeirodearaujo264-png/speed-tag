"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { criarLote } from "@/lib/placas/criacao";

export type EstadoNovoLote = { erro: string | null };

const esquema = z.object({
  nome: z.string().trim().min(1, "Dê um nome ao lote.").max(120, "Nome com no máximo 120 caracteres."),
  quantidade: z.coerce
    .number({ error: "Informe a quantidade." })
    .int("A quantidade deve ser um número inteiro.")
    .min(1, "Mínimo de 1 placa.")
    .max(10_000, "Máximo de 10.000 placas por lote."),
  revendedor: z.string().trim().max(120).optional(),
});

export async function criarLoteAcao(_anterior: EstadoNovoLote, dados: FormData): Promise<EstadoNovoLote> {
  const { supabase } = await exigirAdmin("/admin/lotes/novo");

  const entrada = esquema.safeParse({
    nome: dados.get("nome"),
    quantidade: dados.get("quantidade"),
    revendedor: dados.get("revendedor") || undefined,
  });
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos." };

  const resultado = await criarLote(supabase, {
    nome: entrada.data.nome,
    quantidade: entrada.data.quantidade,
    revendedor: entrada.data.revendedor ?? null,
  });
  if (!resultado.ok) return { erro: resultado.mensagem };

  redirect(`/admin/lotes/${resultado.dado.loteId}?criado=1`);
}
