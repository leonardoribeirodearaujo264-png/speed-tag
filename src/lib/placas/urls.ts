import { urlDoSite } from "@/lib/env";

/** URL gravada no chip NFC. Sem parâmetro: leitura conta como NFC. */
export function urlNfc(codigo: string, base = urlDoSite()): string {
  return new URL(`/t/${codigo}`, base).toString();
}

/** Link que o cliente abre para ativar a placa (entra com o e-mail e cadastra a empresa). */
export function urlAtivacao(codigo: string, base = urlDoSite()): string {
  return new URL(`/ativar/${codigo}`, base).toString();
}

/** URL impressa no QR. `o=q` identifica a origem QR nas estatísticas. */
export function urlQr(codigo: string, base = urlDoSite()): string {
  const url = new URL(`/t/${codigo}`, base);
  url.searchParams.set("o", "q");
  return url.toString();
}
