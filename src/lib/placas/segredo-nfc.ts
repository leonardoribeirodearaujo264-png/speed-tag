import { createHash, randomBytes } from "node:crypto";

export function gerarSegredoNfc(): string {
  return randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g)!.join("-");
}

export function hashSegredoNfc(entrada: string): string | null {
  const segredo = entrada.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(segredo)) return null;
  return createHash("sha256").update(segredo).digest("hex");
}
