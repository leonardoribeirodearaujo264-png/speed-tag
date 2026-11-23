import { z } from "zod";
import { verificarAdminApi } from "@/lib/auth";
import { buscarPlacaPorCodigo, respostaErroBusca } from "@/lib/placas/consultas";
import { TAMANHO_PNG_PADRAO, gerarQrPng, gerarQrSvg } from "@/lib/placas/qr";
import { urlQr } from "@/lib/placas/urls";

const esquema = z.object({
  formato: z.enum(["svg", "png"]).default("svg"),
  tamanho: z.coerce.number().int().min(128).max(4096).default(TAMANHO_PNG_PADRAO),
  baixar: z.enum(["1"]).optional(),
});

/** QR sempre gerado a partir do código: nunca fica desatualizado e não ocupa storage. */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/placas/[codigo]/qr">) {
  const sessao = await verificarAdminApi();
  if (sessao instanceof Response) return sessao;

  const parametros = esquema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parametros.success) return Response.json({ erro: "PARAMETROS_INVALIDOS" }, { status: 400 });

  const { codigo } = await ctx.params;
  const busca = await buscarPlacaPorCodigo(sessao.supabase, codigo);
  if (!busca.ok) return respostaErroBusca(busca.status);

  const placa = busca.dado;
  const { formato, tamanho, baixar } = parametros.data;
  const cabecalhos: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (baixar) cabecalhos["Content-Disposition"] = `attachment; filename="qr-${placa.codigo}.${formato}"`;

  if (formato === "svg") {
    const svg = await gerarQrSvg(urlQr(placa.codigo));
    return new Response(svg, { headers: { ...cabecalhos, "Content-Type": "image/svg+xml; charset=utf-8" } });
  }

  const png = await gerarQrPng(urlQr(placa.codigo), tamanho);
  return new Response(new Uint8Array(png), { headers: { ...cabecalhos, "Content-Type": "image/png" } });
}
