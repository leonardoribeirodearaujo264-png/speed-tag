import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import type { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { MODELO_PADRAO, modeloArte, type ModeloArte } from "@/lib/placas/modelos-arte";
import type { Placa } from "@/lib/supabase/tipos";

type Supabase = Awaited<ReturnType<typeof clienteSupabaseUsuario>>;

export type ResultadoBusca<T> = { ok: true; dado: T } | { ok: false; status: 400 | 404 | 500 };

/** Busca uma placa pelo código (normalizado). Respeita a RLS do cliente usado. */
export async function buscarPlacaPorCodigo(
  supabase: Supabase,
  codigoBruto: string,
): Promise<ResultadoBusca<Placa>> {
  const codigo = normalizarCodigo(codigoBruto);
  if (!codigoValido(codigo)) return { ok: false, status: 400 };

  const { data, error } = await supabase.from("placas").select("*").eq("codigo", codigo).maybeSingle();
  if (error) {
    console.error("[placas] busca por código falhou", error.code);
    return { ok: false, status: 500 };
  }
  if (!data) return { ok: false, status: 404 };
  return { ok: true, dado: data };
}

const PAGINA = 1000;

/**
 * Códigos de um lote em ordem. O PostgREST do Supabase limita cada resposta
 * (padrão 1000 linhas), então pagina. Retorna null em erro.
 */
export async function listarCodigosDoLote(supabase: Supabase, loteId: string): Promise<string[] | null> {
  const codigos: string[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from("placas")
      .select("codigo")
      .eq("lote_id", loteId)
      .order("codigo")
      .range(inicio, inicio + PAGINA - 1);
    if (error) {
      console.error("[placas] listagem do lote falhou", error.code);
      return null;
    }
    codigos.push(...data.map((p) => p.codigo));
    if (data.length < PAGINA) return codigos;
  }
}

export function respostaErroBusca(status: 400 | 404 | 500): Response {
  const erro = { 400: "CODIGO_INVALIDO", 404: "NAO_ENCONTRADA", 500: "ERRO_INTERNO" }[status];
  return Response.json({ erro }, { status });
}

/**
 * Modelo de arte salvo no lote (padrão para placa avulsa). Lê com "*" para continuar
 * funcionando antes da migração 0015, quando a coluna ainda não existe.
 */
export async function modeloDoLote(supabase: Supabase, loteId: string | null): Promise<ModeloArte> {
  if (!loteId) return MODELO_PADRAO;
  const { data } = await supabase.from("lotes").select("*").eq("id", loteId).maybeSingle();
  return modeloArte(data?.modelo_arte);
}

/** Cor da arte de uma placa: a dela, se tiver; senão a do lote; senão a padrão. */
export async function modeloDaPlaca(supabase: Supabase, placa: Pick<Placa, "lote_id" | "modelo_arte">): Promise<ModeloArte> {
  return placa.modelo_arte ? modeloArte(placa.modelo_arte) : modeloDoLote(supabase, placa.lote_id);
}

/** Cor de cada código (a da placa ou a do lote), para a folha de impressão. */
export async function modelosDasPlacas(supabase: Supabase, codigos: string[], padraoDoLote: ModeloArte): Promise<Map<string, ModeloArte>> {
  const mapa = new Map<string, ModeloArte>(codigos.map((c) => [c, padraoDoLote]));
  const BLOCO = 200; // códigos por consulta (a lista vai na URL)
  for (let inicio = 0; inicio < codigos.length; inicio += BLOCO) {
    const { data, error } = await supabase.from("placas").select("*").in("codigo", codigos.slice(inicio, inicio + BLOCO));
    if (error) {
      console.error("[placas] cores das placas", error.code);
      continue;
    }
    for (const p of data) if (p.modelo_arte) mapa.set(p.codigo, modeloArte(p.modelo_arte));
  }
  return mapa;
}

/** Quantas placas do lote saem com cada cor (as sem cor própria contam na cor do lote). */
export async function contarCoresDoLote(supabase: Supabase, loteId: string, padrao: ModeloArte): Promise<Record<ModeloArte, number>> {
  const contar = async (cor?: ModeloArte) => {
    let consulta = supabase.from("placas").select("id", { count: "exact", head: true }).eq("lote_id", loteId);
    if (cor) consulta = consulta.eq("modelo_arte", cor);
    const { count, error } = await consulta;
    return error ? 0 : count ?? 0;
  };
  const [total, azul, preta] = await Promise.all([contar(), contar("azul"), contar("preta")]);
  const semCor = Math.max(0, total - azul - preta);
  return { azul: azul + (padrao === "azul" ? semCor : 0), preta: preta + (padrao === "preta" ? semCor : 0) };
}
