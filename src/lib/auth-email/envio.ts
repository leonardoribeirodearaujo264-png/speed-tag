import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { caminhoInternoSeguro } from "@/lib/auth";
import { envPublico, urlDoSiteParaLogin } from "@/lib/env";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";

/**
 * E-mails do Supabase Auth (cadastro, acesso, recuperação, convite).
 *
 * Os modelos (supabase/templates) montam o botão como
 *   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=<tipo>
 * e /auth/confirmar valida o token com verifyOtp. O token é de uso único, expira e funciona
 * em qualquer navegador (o cliente abre o e-mail no app do Gmail, por exemplo), diferente do
 * fluxo PKCE, que exige o mesmo navegador. Por isso o retorno é sempre o endereço puro de
 * /auth/confirmar, sem parâmetros; para onde ir depois fica num cookie curto (melhor esforço).
 */

const COOKIE_PROXIMO = "st_proximo";

export async function urlRetornoAuth(): Promise<string> {
  const host = (await headers()).get("host");
  return `${urlDoSiteParaLogin(host)}/auth/confirmar`;
}

/** Guarda para onde ir depois do link do e-mail (só caminho interno). */
export async function lembrarProximo(proximo: string | null | undefined) {
  const destino = caminhoInternoSeguro(proximo, "");
  if (!destino) return;
  (await cookies()).set(COOKIE_PROXIMO, destino, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 2,
    path: "/",
  });
}

export async function consumirProximo(): Promise<string | null> {
  const loja = await cookies();
  const valor = loja.get(COOKIE_PROXIMO)?.value ?? null;
  if (valor) loja.delete(COOKIE_PROXIMO);
  return valor ? caminhoInternoSeguro(valor, "") || null : null;
}

/** Cliente anônimo sem sessão: só para pedir os e-mails do Auth no servidor. */
export function clienteAuthAnonimo() {
  const env = envPublico();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" },
  });
}

export type TipoEnvio = "ativacao" | "reenvio_admin" | "cadastro";

/** Limites por e-mail, além do limite do próprio Supabase (1 envio por minuto por endereço). */
export const LIMITES_ENVIO: Record<TipoEnvio, { quantidade: number; janelaMinutos: number }> = {
  ativacao: { quantidade: 5, janelaMinutos: 60 },
  reenvio_admin: { quantidade: 3, janelaMinutos: 60 },
  cadastro: { quantidade: 5, janelaMinutos: 60 },
};

/** Conta o envio se couber no limite. false = limite atingido (ou banco sem a migração 0022). */
export async function registrarEnvio(email: string, tipo: TipoEnvio): Promise<boolean> {
  const { quantidade, janelaMinutos } = LIMITES_ENVIO[tipo];
  const { data, error } = await clienteSupabaseServico().rpc("speed_tag_registrar_envio", {
    p_email: email,
    p_tipo: tipo,
    p_limite: quantidade,
    p_janela_minutos: janelaMinutos,
  });
  if (error) {
    console.error("[emails] registrar envio", error.code);
    return false;
  }
  return data === true;
}

export function mensagemErroEnvio(status?: number): string {
  return status === 429
    ? "Já enviamos um e-mail há pouco. Aguarde um minuto e tente de novo."
    : "Não foi possível enviar o e-mail agora. Tente de novo em instantes.";
}
