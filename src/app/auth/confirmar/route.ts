import { NextResponse, type NextRequest } from "next/server";
import { caminhoInternoSeguro } from "@/lib/auth";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

/** Troca o código de acesso ou recuperação pela sessão. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const codigo = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const proximo = caminhoInternoSeguro(searchParams.get("proximo"), "/painel/empresas");
  const recuperacao = searchParams.get("recuperar") === "1";
  const voltarAoLogin = () => {
    const destino = new URL(recuperacao ? "/recuperar-senha" : "/entrar", request.url);
    destino.searchParams.set("erro", "link");
    destino.searchParams.set("proximo", proximo);
    return NextResponse.redirect(destino);
  };

  if (!codigo) {
    return voltarAoLogin();
  }

  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.auth.exchangeCodeForSession(codigo, flowId ? { flowId } : undefined);
  if (error) {
    console.error("[auth/confirmar] troca de código falhou", error.status, error.code);
    return voltarAoLogin();
  }
  const sessaoRecuperacao = "redirectType" in data && data.redirectType === "recovery";
  if (recuperacao && !sessaoRecuperacao) return voltarAoLogin();

  // Quem já tinha conta na loja (Auth compartilhado) não tem perfil ainda.
  const { error: erroPerfil } = await supabase.rpc("garantir_perfil");
  if (erroPerfil) console.error("[auth/confirmar] garantir_perfil falhou", erroPerfil.code);

  if (sessaoRecuperacao) {
    const destino = new URL("/recuperar-senha/nova", request.url);
    destino.searchParams.set("proximo", proximo);
    return NextResponse.redirect(destino);
  }

  const { error: erroReivindicar } = await supabase.rpc("reivindicar_placas");
  if (erroReivindicar) {
    // Não impede o login; a reivindicação roda de novo no próximo acesso.
    console.error("[auth/confirmar] reivindicar_placas falhou", erroReivindicar.code);
  }

  return NextResponse.redirect(new URL(proximo, request.url));
}
