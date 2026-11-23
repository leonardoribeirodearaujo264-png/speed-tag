import { gerarCodigos } from "@/lib/codigos";
import type { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

type Supabase = Awaited<ReturnType<typeof clienteSupabaseUsuario>>;

export type ResultadoCriacao<T> = { ok: true; dado: T } | { ok: false; mensagem: string };

/**
 * Colisão de código é rara (1 bilhão de combinações), mas possível: a função
 * do banco aborta a transação inteira e aqui geramos novos códigos.
 */
const TENTATIVAS = 3;

function ehColisao(erro: { code?: string; message?: string }): boolean {
  return erro.code === "23505" && (erro.message ?? "").includes("COLISAO_CODIGO");
}

function mensagemErro(erro: { code?: string }): string {
  if (erro.code === "42501") return "Sua conta não tem permissão para criar placas.";
  return "Não foi possível criar agora. Tente de novo.";
}

export async function criarPlacaUnica(
  supabase: Supabase,
  loteId: string | null,
): Promise<ResultadoCriacao<{ codigo: string }>> {
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const { data, error } = await supabase.rpc("criar_placas", {
      p_codigos: gerarCodigos(1),
      p_lote_id: loteId,
    });
    if (!error && data?.[0]) return { ok: true, dado: { codigo: data[0].codigo } };
    if (error && ehColisao(error)) continue;
    console.error("[criacao] criar_placas falhou", error?.code);
    return { ok: false, mensagem: mensagemErro(error ?? {}) };
  }
  return { ok: false, mensagem: "Não foi possível gerar um código livre. Tente de novo." };
}

export async function criarLote(
  supabase: Supabase,
  entrada: { nome: string; quantidade: number; revendedor: string | null },
): Promise<ResultadoCriacao<{ loteId: string }>> {
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const { data, error } = await supabase.rpc("criar_lote", {
      p_nome: entrada.nome,
      p_codigos: gerarCodigos(entrada.quantidade),
      p_revendedor: entrada.revendedor,
    });
    if (!error && data) return { ok: true, dado: { loteId: data } };
    if (error && ehColisao(error)) continue;
    console.error("[criacao] criar_lote falhou", error?.code);
    return { ok: false, mensagem: mensagemErro(error ?? {}) };
  }
  return { ok: false, mensagem: "Não foi possível gerar códigos livres. Tente de novo." };
}
