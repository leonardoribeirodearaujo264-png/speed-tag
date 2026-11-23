import { z } from "zod";
import { gerarCsv } from "@/lib/arquivos/csv";
import { criarZip } from "@/lib/arquivos/zip";
import { verificarAdminApi } from "@/lib/auth";
import { listarCodigosDoLote } from "@/lib/placas/consultas";
import { gerarQrSvg } from "@/lib/placas/qr";
import { urlNfc, urlQr } from "@/lib/placas/urls";

const esquema = z.object({ formato: z.enum(["csv", "zip"]) });

export async function GET(request: Request, ctx: RouteContext<"/api/admin/lotes/[id]/exportar">) {
  const sessao = await verificarAdminApi();
  if (sessao instanceof Response) return sessao;

  const { id } = await ctx.params;
  const parametros = esquema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!z.uuid().safeParse(id).success || !parametros.success) {
    return Response.json({ erro: "PARAMETROS_INVALIDOS" }, { status: 400 });
  }

  const { data: lote, error: erroLote } = await sessao.supabase
    .from("lotes")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();
  if (erroLote) return Response.json({ erro: "ERRO_INTERNO" }, { status: 500 });
  if (!lote) return Response.json({ erro: "NAO_ENCONTRADO" }, { status: 404 });

  const codigos = await listarCodigosDoLote(sessao.supabase, id);
  if (!codigos) return Response.json({ erro: "ERRO_INTERNO" }, { status: 500 });
  const placas = codigos.map((codigo) => ({ codigo }));

  const nomeBase = `lote-${lote.nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "-")
    .slice(0, 40)}`;
  const cabecalhos = { "Cache-Control": "private, no-store" };

  if (parametros.data.formato === "csv") {
    const csv = gerarCsv(
      ["codigo", "url_nfc", "url_qr"],
      placas.map((p) => [p.codigo, urlNfc(p.codigo), urlQr(p.codigo)]),
    );
    return new Response(csv, {
      headers: {
        ...cabecalhos,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeBase}.csv"`,
      },
    });
  }

  const arquivos = await Promise.all(
    placas.map(async (p) => ({ nome: `${p.codigo}.svg`, conteudo: await gerarQrSvg(urlQr(p.codigo)) })),
  );
  const zip = criarZip(arquivos);
  return new Response(new Uint8Array(zip), {
    headers: {
      ...cabecalhos,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeBase}-qr.zip"`,
    },
  });
}
