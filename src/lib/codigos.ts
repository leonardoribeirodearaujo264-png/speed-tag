/**
 * Códigos das placas: Crockford Base32 sem I, L, O, U (evita confusão na leitura
 * e palavrões acidentais). 6 caracteres = 32^6 ≈ 1,07 bilhão de combinações.
 * O mesmo alfabeto está no CHECK de public.placas e em public.normalizar_codigo().
 */
export const ALFABETO_CODIGO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TAMANHO_CODIGO = 6;

const REGEX_CODIGO = new RegExp(`^[${ALFABETO_CODIGO}]{${TAMANHO_CODIGO}}$`);

/** Maiúsculas, sem espaços e hífens; O vira 0, I e L viram 1. */
export function normalizarCodigo(entrada: string): string {
  return entrada
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function codigoValido(codigo: string): boolean {
  return REGEX_CODIGO.test(codigo);
}

/**
 * Gera um código aleatório com crypto seguro. 256 é múltiplo de 32,
 * então o módulo não introduz viés.
 */
export function gerarCodigo(): string {
  const bytes = new Uint8Array(TAMANHO_CODIGO);
  crypto.getRandomValues(bytes);
  let codigo = "";
  for (const byte of bytes) {
    codigo += ALFABETO_CODIGO[byte % ALFABETO_CODIGO.length];
  }
  return codigo;
}

/** Gera `quantidade` códigos distintos entre si (a unicidade no banco é garantida pelo UNIQUE). */
export function gerarCodigos(quantidade: number): string[] {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 10_000) {
    throw new RangeError("quantidade deve ser um inteiro entre 1 e 10000");
  }
  const codigos = new Set<string>();
  while (codigos.size < quantidade) {
    codigos.add(gerarCodigo());
  }
  return [...codigos];
}
