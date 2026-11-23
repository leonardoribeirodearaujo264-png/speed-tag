import { verificarAdminApi } from "@/lib/auth";
import { buscarPlacaPorCodigo, modeloDoLote, respostaErroBusca } from "@/lib/placas/consultas";
import { modeloArte } from "@/lib/placas/modelos-arte";
import { respostaArtePlaca } from "@/lib/placas/resposta-arte";

export async function GET(request: Request, ctx: RouteContext<"/api/admin/placas/[codigo]/arte">) {
  const sessao = await verificarAdminApi();
  if (sessao instanceof Response) return sessao;

  const { codigo } = await ctx.params;
  const busca = await buscarPlacaPorCodigo(sessao.supabase, codigo);
  if (!busca.ok) return respostaErroBusca(busca.status);

  const placa = busca.dado;
  const parametros = new URL(request.url).searchParams;
  const baixar = parametros.get("baixar") === "1";
  // Sem ?modelo=, vale a arte salva no lote da placa.
  const pedido = parametros.get("modelo");
  const modelo = pedido ? modeloArte(pedido) : await modeloDoLote(sessao.supabase, placa.lote_id);
  return respostaArtePlaca(placa.codigo, modelo, baixar);
}
