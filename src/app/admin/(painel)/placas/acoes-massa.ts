"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { codigoValido } from "@/lib/codigos";
import { criarPlacaUnica } from "@/lib/placas/criacao";

export type ResultadoMassa = { ok: boolean; mensagem: string };

type Supabase = Awaited<ReturnType<typeof exigirAdmin>>["supabase"];

const LIMITE = 500;
const esquemaCodigos = z.array(z.string().refine(codigoValido)).min(1, "Selecione ao menos uma placa.").max(LIMITE, `Máximo de ${LIMITE} placas por vez.`);

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function atualizar() {
  revalidatePath("/admin/placas");
  revalidatePath("/admin");
}

async function usuarioPorEmail(supabase: Supabase, email: string) {
  const { data } = await supabase.from("perfis").select("id, nome, email").eq("email", email.trim().toLowerCase()).maybeSingle();
  return data;
}

function lerResposta(resposta: { data: unknown; error: { code?: string; message?: string } | null }) {
  if (resposta.error) {
    console.error("[placas-massa]", resposta.error.code);
    return { ok: false as const, erro: resposta.error.message?.includes("PLACA_INDISPONIVEL") ? "PLACA_INDISPONIVEL" : "FALHA" };
  }
  const r = resposta.data as { ok: boolean; erro?: string; quantidade?: number };
  return r.ok ? { ok: true as const, quantidade: r.quantidade ?? 0 } : { ok: false as const, erro: r.erro ?? "FALHA" };
}

/** Atribui placas em estoque a um cliente (todas precisam estar em estoque ou reservadas). */
export async function atribuirEmMassa(codigos: string[], email: string): Promise<ResultadoMassa> {
  const { supabase } = await exigirAdmin("/admin/placas");
  const entrada = esquemaCodigos.safeParse(codigos);
  if (!entrada.success) return { ok: false, mensagem: entrada.error.issues[0]?.message ?? "Seleção inválida." };
  const usuario = await usuarioPorEmail(supabase, email);
  if (!usuario) return { ok: false, mensagem: "Nenhum usuário com esse e-mail. Crie a conta em Usuários antes." };

  const r = lerResposta(await supabase.rpc("admin_atribuir_placas", { p_codigos: entrada.data, p_usuario: usuario.id }));
  if (!r.ok) {
    return {
      ok: false,
      mensagem: r.erro === "PLACA_INDISPONIVEL" ? "Alguma placa selecionada não está em estoque. Nada foi atribuído." : "Não foi possível atribuir agora.",
    };
  }
  atualizar();
  return { ok: true, mensagem: `${plural(r.quantidade, "placa atribuída", "placas atribuídas")} a ${usuario.nome ?? usuario.email}.` };
}

/** Transfere placas atribuídas ou ativas para outro cliente. */
export async function transferirEmMassa(codigos: string[], email: string): Promise<ResultadoMassa> {
  const { supabase } = await exigirAdmin("/admin/placas");
  const entrada = esquemaCodigos.safeParse(codigos);
  if (!entrada.success) return { ok: false, mensagem: entrada.error.issues[0]?.message ?? "Seleção inválida." };
  const usuario = await usuarioPorEmail(supabase, email);
  if (!usuario) return { ok: false, mensagem: "Nenhum usuário com esse e-mail. Crie a conta em Usuários antes." };

  const r = lerResposta(await supabase.rpc("admin_transferir_placas", { p_codigos: entrada.data, p_usuario: usuario.id }));
  if (!r.ok) return { ok: false, mensagem: "Não foi possível transferir agora." };
  if (r.quantidade === 0) return { ok: false, mensagem: "Nenhuma placa transferida: só placas atribuídas ou ativas, de outro cliente, podem ser transferidas." };
  atualizar();
  const ignoradas = entrada.data.length - r.quantidade;
  return {
    ok: true,
    mensagem: `${plural(r.quantidade, "placa transferida", "placas transferidas")}${ignoradas ? ` (${ignoradas} ignoradas: em estoque, desativadas ou já desse cliente)` : ""}.`,
  };
}

export async function moverLoteEmMassa(codigos: string[], loteId: string | null): Promise<ResultadoMassa> {
  const { supabase } = await exigirAdmin("/admin/placas");
  const entrada = esquemaCodigos.safeParse(codigos);
  if (!entrada.success) return { ok: false, mensagem: entrada.error.issues[0]?.message ?? "Seleção inválida." };
  if (loteId !== null && !z.uuid().safeParse(loteId).success) return { ok: false, mensagem: "Lote inválido." };

  const r = lerResposta(await supabase.rpc("admin_mover_lote", { p_codigos: entrada.data, p_lote: loteId }));
  if (!r.ok) return { ok: false, mensagem: r.erro === "LOTE_NAO_ENCONTRADO" ? "Lote não encontrado." : "Não foi possível mover agora." };
  atualizar();
  revalidatePath("/admin/lotes");
  return { ok: true, mensagem: `${plural(r.quantidade, "placa movida", "placas movidas")} ${loteId ? "para o lote" : "para avulsas"}.` };
}

/** Desativa ou reativa uma a uma (cada uma com histórico); placas já na situação pedida são ignoradas. */
export async function alternarEmMassa(codigos: string[], acao: "desativar" | "reativar"): Promise<ResultadoMassa> {
  const { supabase } = await exigirAdmin("/admin/placas");
  const entrada = esquemaCodigos.safeParse(codigos);
  if (!entrada.success) return { ok: false, mensagem: entrada.error.issues[0]?.message ?? "Seleção inválida." };

  const { data: placas, error } = await supabase.from("placas").select("id, status").in("codigo", entrada.data);
  if (error) return { ok: false, mensagem: "Não foi possível carregar as placas." };

  let feitas = 0;
  for (const placa of placas ?? []) {
    if ((acao === "desativar") === (placa.status === "desativada")) continue;
    const resposta =
      acao === "desativar"
        ? await supabase.rpc("admin_desativar_placa", { p_placa: placa.id, p_motivo: "Ação em massa" })
        : await supabase.rpc("admin_reativar_placa", { p_placa: placa.id });
    if (lerResposta(resposta).ok) feitas++;
  }
  atualizar();
  return {
    ok: feitas > 0,
    mensagem: feitas
      ? `${plural(feitas, acao === "desativar" ? "placa desativada" : "placa reativada", acao === "desativar" ? "placas desativadas" : "placas reativadas")}.`
      : `Nenhuma placa precisava ser ${acao === "desativar" ? "desativada" : "reativada"}.`,
  };
}

/** Cria uma placa nova no mesmo lote (código novo, sem dono e sem empresa). */
export async function duplicarPlaca(codigo: string): Promise<ResultadoMassa> {
  const { supabase } = await exigirAdmin("/admin/placas");
  if (!codigoValido(codigo)) return { ok: false, mensagem: "Placa inválida." };
  const { data: original } = await supabase.from("placas").select("lote_id").eq("codigo", codigo).maybeSingle();
  if (!original) return { ok: false, mensagem: "Placa não encontrada." };

  const criada = await criarPlacaUnica(supabase, original.lote_id);
  if (!criada.ok) return { ok: false, mensagem: criada.mensagem };
  atualizar();
  redirect(`/admin/placas/${criada.dado.codigo}?criada=1`);
}
