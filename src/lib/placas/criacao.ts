import { gerarCodigos } from "@/lib/codigos";
import { MODELO_PADRAO, NOMES_MODELOS, type ModeloArte } from "@/lib/placas/modelos-arte";
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
  entrada: { nome: string; quantidades: Record<ModeloArte, number>; revendedor: string | null },
): Promise<ResultadoCriacao<{ loteId: string }>> {
  const cores = NOMES_MODELOS.filter((m) => entrada.quantidades[m] > 0);
  const total = cores.reduce((soma, m) => soma + entrada.quantidades[m], 0);
  // Cor do lote: a que tem mais placas. Placas de outra cor guardam a própria (lote misto).
  const principal = cores.reduce<ModeloArte>((a, m) => (entrada.quantidades[m] > entrada.quantidades[a] ? m : a), cores[0] ?? MODELO_PADRAO);

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const codigos = gerarCodigos(total);
    const { data, error } = await supabase.rpc("criar_lote", {
      p_nome: entrada.nome,
      p_codigos: codigos,
      p_revendedor: entrada.revendedor,
    });
    if (!error && data) {
      // Lote já criado: se gravar a cor falhar, o admin ajusta na página do lote.
      if (principal !== MODELO_PADRAO) {
        const { error: erroModelo } = await supabase.from("lotes").update({ modelo_arte: principal }).eq("id", data);
        if (erroModelo) console.error("[criacao] modelo da arte do lote", erroModelo.code);
      }
      if (cores.length > 1) {
        let inicio = 0;
        for (const cor of cores) {
          const grupo = codigos.slice(inicio, inicio + entrada.quantidades[cor]);
          inicio += grupo.length;
          const { error: erroCor } = await supabase.rpc("speed_tag_definir_cor_placas", { p_codigos: grupo, p_modelo: cor });
          if (erroCor) {
            console.error("[criacao] cor das placas", cor, erroCor.code);
            return { ok: false, mensagem: "O lote foi criado, mas as cores das placas não foram salvas. Rode a migração 0026 e ajuste na página do lote." };
          }
        }
      }
      return { ok: true, dado: { loteId: data } };
    }
    if (error && ehColisao(error)) continue;
    console.error("[criacao] criar_lote falhou", error?.code);
    return { ok: false, mensagem: mensagemErro(error ?? {}) };
  }
  return { ok: false, mensagem: "Não foi possível gerar códigos livres. Tente de novo." };
}
