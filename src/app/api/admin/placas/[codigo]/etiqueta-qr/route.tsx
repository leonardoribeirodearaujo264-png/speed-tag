import { posicaoCodigo } from "@/components/placa/etiqueta-qr";
import { verificarAdminApi } from "@/lib/auth";
import { buscarPlacaPorCodigo, respostaErroBusca } from "@/lib/placas/consultas";
import { ladoDaArte } from "@/lib/placas/resposta-arte";
import { respostaEtiquetaQr } from "@/lib/placas/resposta-etiqueta";

export async function GET(request: Request, ctx: RouteContext<"/api/admin/placas/[codigo]/etiqueta-qr">) {
  const sessao = await verificarAdminApi();
  if (sessao instanceof Response) return sessao;

  const { codigo } = await ctx.params;
  const busca = await buscarPlacaPorCodigo(sessao.supabase, codigo);
  if (!busca.ok) return respostaErroBusca(busca.status);

  const parametros = new URL(request.url).searchParams;
  return respostaEtiquetaQr(
    busca.dado.codigo,
    posicaoCodigo(parametros.get("posicao")),
    parametros.get("baixar") === "1",
    ladoDaArte(parametros.get("lado")),
  );
}
