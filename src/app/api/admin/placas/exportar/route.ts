import { z } from "zod";
import { gerarCsv } from "@/lib/arquivos/csv";
import { criarZip } from "@/lib/arquivos/zip";
import { verificarAdminApi } from "@/lib/auth";
import { codigoValido } from "@/lib/codigos";
import { gerarQrSvg } from "@/lib/placas/qr";
import { ROTULO_STATUS } from "@/lib/placas/rotulos";
import { urlAtivacao, urlNfc, urlQr } from "@/lib/placas/urls";

const esquema = z.object({
  formato: z.enum(["csv", "zip"]),
  codigos: z
    .string()
    .transform((v) => v.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))
    .pipe(z.array(z.string().refine(codigoValido)).min(1).max(500)),
});

/** Exporta as placas selecionadas na lista: CSV com links ou ZIP com os QR Codes. */
export async function GET(request: Request) {
  const sessao = await verificarAdminApi();
  if (sessao instanceof Response) return sessao;

  const parametros = esquema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parametros.success) return Response.json({ erro: "PARAMETROS_INVALIDOS" }, { status: 400 });
  const { formato, codigos } = parametros.data;

  const { data: placas, error } = await sessao.supabase
    .from("placas")
    .select("codigo, status, empresa_id, dono_id")
    .in("codigo", codigos)
    .order("codigo");
  if (error) return Response.json({ erro: "ERRO_INTERNO" }, { status: 500 });

  const cabecalhos = { "Cache-Control": "private, no-store" };
  const nome = `placas-${new Date().toISOString().slice(0, 10)}`;

  if (formato === "zip") {
    const arquivos = await Promise.all(placas.map(async (p) => ({ nome: `${p.codigo}.svg`, conteudo: await gerarQrSvg(urlQr(p.codigo)) })));
    return new Response(new Uint8Array(criarZip(arquivos)), {
      headers: { ...cabecalhos, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${nome}-qr.zip"` },
    });
  }

  const empresas = new Map<string, string>();
  const idsEmpresas = [...new Set(placas.map((p) => p.empresa_id).filter((v): v is string => !!v))];
  if (idsEmpresas.length) {
    const { data } = await sessao.supabase.from("empresas").select("id, nome").in("id", idsEmpresas);
    for (const e of data ?? []) empresas.set(e.id, e.nome);
  }
  const donos = new Map<string, string>();
  const idsDonos = [...new Set(placas.map((p) => p.dono_id).filter((v): v is string => !!v))];
  if (idsDonos.length) {
    const { data } = await sessao.supabase.from("perfis").select("id, email").in("id", idsDonos);
    for (const d of data ?? []) donos.set(d.id, d.email ?? "");
  }

  const csv = gerarCsv(
    ["codigo", "situacao", "empresa", "cliente", "url_nfc", "url_qr", "link_ativacao"],
    placas.map((p) => [
      p.codigo,
      ROTULO_STATUS[p.status],
      p.empresa_id ? empresas.get(p.empresa_id) ?? "" : "",
      p.dono_id ? donos.get(p.dono_id) ?? "" : "",
      urlNfc(p.codigo),
      urlQr(p.codigo),
      urlAtivacao(p.codigo),
    ]),
  );
  return new Response(csv, {
    headers: { ...cabecalhos, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}.csv"` },
  });
}
