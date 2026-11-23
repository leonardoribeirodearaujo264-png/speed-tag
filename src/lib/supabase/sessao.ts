/** Sem "Lembrar de mim": cookie de sessão marca que a sessão some ao fechar o navegador. */
export const COOKIE_SESSAO_TEMPORARIA = "st_sessao_temporaria";

/** Tira a validade dos cookies do Supabase quando a sessão é temporária. */
export function opcoesDaSessao<T extends { maxAge?: number; expires?: Date }>(opcoes: T, temporaria: boolean): T {
  if (!temporaria) return opcoes;
  const resto = { ...opcoes };
  delete resto.maxAge;
  delete resto.expires;
  return resto;
}
