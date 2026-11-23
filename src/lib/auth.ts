import { redirect } from "next/navigation";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

type SessaoAdmin = {
  supabase: Awaited<ReturnType<typeof clienteSupabaseUsuario>>;
  usuarioId: string;
  email: string | null;
};

async function obterSessaoAdmin(): Promise<SessaoAdmin | "sem_login" | "sem_permissao"> {
  const supabase = await clienteSupabaseUsuario();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "sem_login";

  const { data: admin, error } = await supabase.rpc("eh_admin");
  if (error || admin !== true) return "sem_permissao";

  return { supabase, usuarioId: user.id, email: user.email ?? null };
}

/** Para páginas e Server Actions do admin: redireciona quem não pode entrar. */
export async function exigirAdmin(proximo = "/admin"): Promise<SessaoAdmin> {
  const sessao = await obterSessaoAdmin();
  if (sessao === "sem_login") redirect(`/admin/entrar?proximo=${encodeURIComponent(proximo)}`);
  if (sessao === "sem_permissao") redirect("/painel");
  return sessao;
}

/** Para Route Handlers do admin: devolve a sessão ou a resposta de erro pronta. */
export async function verificarAdminApi(): Promise<SessaoAdmin | Response> {
  const sessao = await obterSessaoAdmin();
  if (sessao === "sem_login") return Response.json({ erro: "NAO_AUTENTICADO" }, { status: 401 });
  if (sessao === "sem_permissao") return Response.json({ erro: "SEM_PERMISSAO" }, { status: 403 });
  return sessao;
}

/** Aceita só caminhos internos, para o redirecionamento pós-login não virar open redirect. */
export function caminhoInternoSeguro(valor: string | null | undefined, padrao = "/admin"): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\") ||
    [...valor].some((caractere) => caractere.charCodeAt(0) < 32 || caractere.charCodeAt(0) === 127)) {
    return padrao;
  }
  return valor;
}

/** Destino padrão do cliente depois de entrar. */
export const DESTINO_CLIENTE = "/painel/empresas";

/**
 * Para onde ir depois de entrar pelo login único (/entrar). Quem pediu um destino
 * específico (ativação de placa, link do e-mail) vai para ele; sem destino, o ADM vai
 * ao painel administrativo e o cliente ao painel dele.
 */
export async function destinoAposLogin(
  supabase: Awaited<ReturnType<typeof clienteSupabaseUsuario>>,
  proximo: string | null | undefined,
): Promise<string> {
  const pedido = caminhoInternoSeguro(proximo, DESTINO_CLIENTE);
  if (pedido !== DESTINO_CLIENTE) return pedido;
  const { data: admin } = await supabase.rpc("eh_admin");
  return admin === true ? "/admin/placas" : DESTINO_CLIENTE;
}
