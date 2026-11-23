import { readFile } from "node:fs/promises";
import path from "node:path";
import { MODELOS_ARTE, type ModeloArte } from "@/lib/placas/modelos-arte";

const cache = new Map<ModeloArte, string>();

/**
 * Fundo da arte como data URI, para o Satori (PNG). Lido de public/ no servidor;
 * next.config inclui public/placas no pacote da rota (outputFileTracingIncludes).
 */
export async function fundoArteDataUri(modelo: ModeloArte): Promise<string> {
  const pronto = cache.get(modelo);
  if (pronto) return pronto;
  const arquivo = path.join(process.cwd(), "public", MODELOS_ARTE[modelo].arquivo);
  const dataUri = `data:image/jpeg;base64,${(await readFile(arquivo)).toString("base64")}`;
  cache.set(modelo, dataUri);
  return dataUri;
}
