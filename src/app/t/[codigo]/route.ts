import { after, NextResponse, type NextRequest } from "next/server";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { dispositivoDe, origemDaLeitura, paisDe } from "@/lib/placas/redirecionamento";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";

/**
 * Endereço gravado no NFC e impresso no QR. Placa ativa vai direto para a
 * avaliação; qualquer outra situação abre a página pública da placa.
 * A leitura é registrada depois da resposta (after), fora do caminho crítico.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/t/[codigo]">) {
  const { codigo: bruto } = await ctx.params;
  const codigo = normalizarCodigo(bruto);
  const dispositivo = dispositivoDe(request.headers.get("user-agent"));
  const pais = paisDe(request.headers.get("x-vercel-ip-country"));
  const semCache = { "Cache-Control": "no-store" };

  const paginaDaPlaca = (alvo: string) => {
    const resposta = NextResponse.redirect(new URL(`/placa/${encodeURIComponent(alvo)}`, request.url), 302);
    resposta.headers.set("Cache-Control", "no-store");
    return resposta;
  };

  if (!codigoValido(codigo)) {
    after(() => registrarInvalido(bruto, dispositivo, pais));
    return paginaDaPlaca(codigo || "invalido");
  }

  const supabase = clienteSupabaseServico();
  const { data, error } = await supabase.rpc("resumo_redirecionamento", { p_codigo: codigo });
  if (error) {
    console.error("[t] consulta falhou", error.code);
    return new NextResponse("Não foi possível abrir esta placa agora. Tente de novo em instantes.", {
      status: 503,
      headers: { ...semCache, "Content-Type": "text/plain; charset=utf-8", "Retry-After": "5" },
    });
  }

  const placa = data?.[0];
  if (!placa) {
    after(() => registrarInvalido(codigo, dispositivo, pais));
    return paginaDaPlaca(codigo);
  }

  // Defesa em profundidade: só redireciona para domínio do Google, mesmo que o banco tenha outro valor.
  if (placa.situacao === "ativa" && placa.destino_url && linkGooglePermitido(placa.destino_url)) {
    const origem = origemDaLeitura(request.nextUrl.searchParams);
    after(async () => {
      const { error: erroLeitura } = await supabase.rpc("registrar_leitura", {
        p_placa_id: placa.id,
        p_origem: origem,
        p_dispositivo: dispositivo,
        p_pais: pais,
      });
      if (erroLeitura) console.error("[t] registrar_leitura falhou", erroLeitura.code);
    });
    return NextResponse.redirect(placa.destino_url, { status: 302, headers: semCache });
  }

  // Placa atribuída ou tag preparada ainda não ativada vai direto para a ativação (sem passar por /placa).
  if (placa.situacao !== "desativada" && placa.situacao !== "ativa") {
    const { data: extra } = await supabase.from("placas").select("preparada_nfc").eq("id", placa.id).maybeSingle();
    if (placa.situacao === "atribuida" || extra?.preparada_nfc) {
      const resposta = NextResponse.redirect(new URL(`/ativar/${placa.codigo}`, request.url), 302);
      resposta.headers.set("Cache-Control", "no-store");
      return resposta;
    }
  }

  return paginaDaPlaca(placa.codigo);
}

async function registrarInvalido(codigo: string, dispositivo: string, pais: string | null) {
  const { error } = await clienteSupabaseServico().rpc("registrar_acesso_invalido", {
    p_codigo: codigo.slice(0, 32),
    p_dispositivo: dispositivo,
    p_pais: pais,
  });
  if (error) console.error("[t] registrar_acesso_invalido falhou", error.code);
}
