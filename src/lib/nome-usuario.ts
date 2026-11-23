export function nomeUsuario(nome: string | null | undefined, email: string | null | undefined): string {
  return nome?.trim() || email?.trim() || "Usuário sem identificação";
}
