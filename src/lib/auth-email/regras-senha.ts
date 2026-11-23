/** Regras de senha, iguais no navegador (lista de requisitos) e no servidor. */
export const REQUISITOS_SENHA = [
  { id: "tamanho", rotulo: "Pelo menos 10 caracteres", ok: (s: string) => s.length >= 10 },
  { id: "letra", rotulo: "Uma letra", ok: (s: string) => /\p{L}/u.test(s) },
  { id: "numero", rotulo: "Um número", ok: (s: string) => /\d/.test(s) },
] as const;

/** Mensagem do primeiro problema, ou null se a senha serve. */
export function validarSenha(senha: string, confirmacao: string): string | null {
  if (new TextEncoder().encode(senha).length > 72) return "Use no máximo 72 caracteres.";
  const falha = REQUISITOS_SENHA.find((r) => !r.ok(senha));
  if (falha) return `A senha precisa ter: ${falha.rotulo.toLowerCase()}.`;
  if (senha !== confirmacao) return "As senhas não coincidem.";
  return null;
}
