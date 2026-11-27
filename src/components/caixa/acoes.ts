"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esquemaCompra, esquemaVenda } from "@/lib/caixa/regras";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export type EstadoCaixa = { ok: boolean; mensagem: string | null };

const VIOLACAO_UNICA = "23505";

async function contaLiberada() {
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Entre novamente para usar o caixa.", supabase: null };
  const { data: liberado } = await supabase.rpc("speed_tag_acesso_cliente");
  if (!liberado) return { erro: "Sua conta precisa estar liberada para usar o caixa.", supabase: null };
  return { erro: "", supabase };
}

function primeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Confira os campos.";
}

export async function lancarVenda(_anterior: EstadoCaixa, dados: FormData): Promise<EstadoCaixa> {
  const venda = esquemaVenda.safeParse(Object.fromEntries(dados));
  if (!venda.success) return { ok: false, mensagem: primeiroErro(venda.error) };
  const conta = await contaLiberada();
  if (!conta.supabase) return { ok: false, mensagem: conta.erro };
  const { error } = await conta.supabase.from("caixa_vendas").insert(venda.data);
  // Mesmo id = mesmo envio repetido (toque duplo, rede lenta): a venda já está salva.
  if (error && error.code !== VIOLACAO_UNICA) {
    console.error("[caixa] lançar venda", error.code);
    return { ok: false, mensagem: "Não foi possível salvar a venda. Tente novamente." };
  }
  revalidatePath("/painel/caixa");
  revalidatePath("/admin/caixa");
  return { ok: true, mensagem: "Venda lançada." };
}

export async function registrarCompra(_anterior: EstadoCaixa, dados: FormData): Promise<EstadoCaixa> {
  const compra = esquemaCompra.safeParse(Object.fromEntries(dados));
  if (!compra.success) return { ok: false, mensagem: primeiroErro(compra.error) };
  const conta = await contaLiberada();
  if (!conta.supabase) return { ok: false, mensagem: conta.erro };
  const { error } = await conta.supabase.from("caixa_compras").insert(compra.data);
  if (error && error.code !== VIOLACAO_UNICA) {
    console.error("[caixa] registrar compra", error.code);
    return { ok: false, mensagem: "Não foi possível registrar a compra. Tente novamente." };
  }
  revalidatePath("/painel/caixa");
  revalidatePath("/admin/caixa");
  return { ok: true, mensagem: "Compra registrada no estoque." };
}

function revalidarCaixa() {
  revalidatePath("/painel/caixa");
  revalidatePath("/admin/caixa");
}

/** Edita uma venda da própria conta (o id vem do formulário; o banco confere o dono). */
export async function editarVenda(_anterior: EstadoCaixa, dados: FormData): Promise<EstadoCaixa> {
  const venda = esquemaVenda.safeParse(Object.fromEntries(dados));
  if (!venda.success) return { ok: false, mensagem: primeiroErro(venda.error) };
  const conta = await contaLiberada();
  if (!conta.supabase) return { ok: false, mensagem: conta.erro };
  const { id, ...campos } = venda.data;
  const { data, error } = await conta.supabase.from("caixa_vendas").update(campos).eq("id", id).select("id");
  if (error || !data?.length) {
    if (error) console.error("[caixa] editar venda", error.code);
    return { ok: false, mensagem: "Não foi possível salvar a alteração. Atualize a página e tente de novo." };
  }
  revalidarCaixa();
  return { ok: true, mensagem: "Venda atualizada." };
}

export async function editarCompra(_anterior: EstadoCaixa, dados: FormData): Promise<EstadoCaixa> {
  const compra = esquemaCompra.safeParse(Object.fromEntries(dados));
  if (!compra.success) return { ok: false, mensagem: primeiroErro(compra.error) };
  const conta = await contaLiberada();
  if (!conta.supabase) return { ok: false, mensagem: conta.erro };
  const { id, ...campos } = compra.data;
  const { data, error } = await conta.supabase.from("caixa_compras").update(campos).eq("id", id).select("id");
  if (error || !data?.length) {
    if (error) console.error("[caixa] editar compra", error.code);
    return { ok: false, mensagem: "Não foi possível salvar a alteração. Atualize a página e tente de novo." };
  }
  revalidarCaixa();
  return { ok: true, mensagem: "Compra atualizada." };
}

export async function excluirLancamento(tipo: "venda" | "compra", id: string): Promise<EstadoCaixa> {
  if (!z.uuid().safeParse(id).success || (tipo !== "venda" && tipo !== "compra")) return { ok: false, mensagem: "Lançamento inválido." };
  const conta = await contaLiberada();
  if (!conta.supabase) return { ok: false, mensagem: conta.erro };
  const tabela = tipo === "venda" ? "caixa_vendas" : "caixa_compras";
  const { data, error } = await conta.supabase.from(tabela).delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, mensagem: "Não foi possível excluir. Atualize a página e tente de novo." };
  revalidatePath("/painel/caixa");
  revalidatePath("/admin/caixa");
  return { ok: true, mensagem: tipo === "venda" ? "Venda excluída." : "Compra excluída." };
}
