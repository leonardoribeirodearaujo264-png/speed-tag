import { envPublico } from "@/lib/env";

/** URL gravada no chip NFC. Sem parâmetro: leitura conta como NFC. */
export function urlNfc(codigo: string, base = envPublico().NEXT_PUBLIC_SITE_URL): string {
  return new URL(`/t/${codigo}`, base).toString();
}

/** URL impressa no QR. `o=q` identifica a origem QR nas estatísticas. */
export function urlQr(codigo: string, base = envPublico().NEXT_PUBLIC_SITE_URL): string {
  const url = new URL(`/t/${codigo}`, base);
  url.searchParams.set("o", "q");
  return url.toString();
}
