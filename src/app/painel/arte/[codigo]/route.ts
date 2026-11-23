import { buscarPlacaPorCodigo, modeloDoLote, respostaErroBusca } from "@/lib/placas/consultas";
import { respostaArtePlaca } from "@/lib/placas/resposta-arte";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export async function GET(request: Request, { params }: RouteContext<"/painel/arte/[codigo]">) {
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  const { codigo } = await params;
  const busca = await buscarPlacaPorCodigo(supabase, codigo);
  if (!busca.ok) return respostaErroBusca(busca.status);
  const placa = busca.dado;
  if (placa.dono_id !== user.id) return respostaErroBusca(404);

  const modelo = placa.lote_id ? await modeloDoLote(clienteSupabaseServico(), placa.lote_id) : await modeloDoLote(supabase, null);
  return respostaArtePlaca(placa.codigo, modelo, new URL(request.url).searchParams.get("baixar") === "1");
}
