import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import type { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
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
