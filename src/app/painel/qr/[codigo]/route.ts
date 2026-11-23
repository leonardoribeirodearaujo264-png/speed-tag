import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { gerarQrPng } from "@/lib/placas/qr";
import { urlQr } from "@/lib/placas/urls";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export async function GET(_request: Request, { params }: RouteContext<"/painel/qr/[codigo]">) {
  const codigo = normalizarCodigo((await params).codigo);
  if (!codigoValido(codigo)) return new Response(null, { status: 404 });
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  const { data, error } = await supabase.from("placas").select("codigo")
    .eq("codigo", codigo).eq("dono_id", user.id).maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (!data) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(await gerarQrPng(urlQr(codigo))), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="speed-tag-${codigo}.png"`,
    },
  });
}
