import { NextResponse, type NextRequest } from "next/server";
import { caminhoInternoSeguro } from "@/lib/auth";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

/** Destino do link mágico: troca o código pela sessão e assume placas ativadas com esse e-mail. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const codigo = searchParams.get("code");
  const proximo = caminhoInternoSeguro(searchParams.get("proximo"), "/painel");
  const voltarAoLogin = () => {
    const destino = new URL("/entrar", request.url);
    destino.searchParams.set("erro", "link");
    destino.searchParams.set("proximo", proximo);
    return NextResponse.redirect(destino);
  };

  if (!codigo) {
    return voltarAoLogin();
  }

  const supabase = await clienteSupabaseUsuario();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);
  if (error) {
    console.error("[auth/confirmar] troca de código falhou", error.status, error.code);
    return voltarAoLogin();
  }

  // Quem já tinha conta na loja (Auth compartilhado) não tem perfil ainda.
  const { error: erroPerfil } = await supabase.rpc("garantir_perfil");
  if (erroPerfil) console.error("[auth/confirmar] garantir_perfil falhou", erroPerfil.code);

  const { error: erroReivindicar } = await supabase.rpc("reivindicar_placas");
  if (erroReivindicar) {
    // Não impede o login; a reivindicação roda de novo no próximo acesso.
    console.error("[auth/confirmar] reivindicar_placas falhou", erroReivindicar.code);
  }

  return NextResponse.redirect(new URL(proximo, request.url));
}
