import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { envPublico, envServidor } from "@/lib/env";
import type { Database } from "./tipos";

/**
 * Cliente com a sessão do usuário (cookies). Respeita RLS.
 * Usar em Server Components, Route Handlers e Server Actions.
 */
export async function clienteSupabaseUsuario() {
  // cookies() e connection() primeiro. Com Cache Components, o Next pré-renderiza trechos que
  // já têm cookies; o supabase-js lê Date.now() ao validar a sessão, o que só é permitido
  // depois de connection(). As páginas com login usam `instant = false` para poder esperar.
  const loja = await cookies();
  await connection();
  const env = envPublico();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (novos) => {
        try {
          for (const { name, value, options } of novos) loja.set(name, value, options);
        } catch {
          // Server Component não pode gravar cookie; o proxy renova a sessão.
        }
      },
    },
  });
}

/**
 * Cliente com service_role: ignora RLS. Só para rotas públicas do servidor
 * (/t, ativação) e tarefas de admin já autorizadas. Nunca expor ao navegador.
 */
export function clienteSupabaseServico() {
  const env = envServidor();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
