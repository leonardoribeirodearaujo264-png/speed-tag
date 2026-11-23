import { ImageResponse } from "next/og";
import { ArtePlaca } from "@/components/placa/arte-placa";
import { verificarAdminApi } from "@/lib/auth";
import { buscarPlacaPorCodigo, respostaErroBusca } from "@/lib/placas/consultas";
import { fundoArteDataUri } from "@/lib/placas/fundo-arte";
import { modeloArte } from "@/lib/placas/modelos-arte";
import { gerarQrSvg, svgParaDataUri } from "@/lib/placas/qr";
import { urlQr } from "@/lib/placas/urls";

/** 2000 px de lado: ~250 dpi numa placa de 20 cm, ~630 dpi numa de 8 cm. */
const LADO = 2000;

export async function GET(request: Request, ctx: RouteContext<"/api/admin/placas/[codigo]/arte">) {
  const sessao = await verificarAdminApi();
  if (sessao instanceof Response) return sessao;

  const { codigo } = await ctx.params;
  const busca = await buscarPlacaPorCodigo(sessao.supabase, codigo);
  if (!busca.ok) return respostaErroBusca(busca.status);

  const placa = busca.dado;
  const qr = svgParaDataUri(await gerarQrSvg(urlQr(placa.codigo)));
  const parametros = new URL(request.url).searchParams;
  const baixar = parametros.get("baixar") === "1";
  const modelo = modeloArte(parametros.get("modelo"));
  const fundo = await fundoArteDataUri(modelo);

  return new ImageResponse(<ArtePlaca codigo={placa.codigo} qrDataUri={qr} tamanho={LADO} modelo={modelo} fundo={fundo} />, {
    width: LADO,
    height: LADO,
    headers: {
      "Cache-Control": "private, no-store",
      ...(baixar ? { "Content-Disposition": `attachment; filename="placa-${placa.codigo}-${modelo}.png"` } : {}),
    },
  });
}
