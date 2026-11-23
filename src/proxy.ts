import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/tipos";

/**
 * Renova a sessão do Supabase nas áreas logadas e faz a checagem otimista
 * de login. A autorização de verdade (papel admin) acontece no servidor,
 * em exigirAdmin() e nas funções do banco.
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) return resposta;

  const supabase = createServerClient<Database>(url, chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (novos) => {
        for (const { name, value } of novos) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of novos) resposta.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  // Admin entra com e-mail e senha em /admin/entrar; cliente, com link mágico em /entrar.
  const areaAdmin =
    pathname.startsWith("/admin") && pathname !== "/admin/entrar" && pathname !== "/admin/registrar";
  const areaCliente = pathname.startsWith("/painel");
  if ((areaAdmin || areaCliente) && !user) {
    const destino = new URL(areaAdmin ? "/admin/entrar" : "/entrar", request.url);
    destino.searchParams.set("proximo", pathname + search);
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: ["/admin/:path*", "/painel/:path*", "/api/admin/:path*", "/auth/:path*", "/entrar", "/ativar/:path*"],
};
