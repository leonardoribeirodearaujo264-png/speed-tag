import type { OrigemLeitura } from "@/lib/supabase/tipos";

/** QR impresso carrega ?o=q; o chip NFC grava a URL sem parâmetro. */
export function origemDaLeitura(parametros: URLSearchParams): OrigemLeitura {
  return parametros.get("o") === "q" ? "qr" : "nfc";
}

export type Dispositivo = "mobile" | "desktop" | "outro";

/** Classificação simples pelo user agent; não guardamos o user agent completo (LGPD). */
export function dispositivoDe(userAgent: string | null): Dispositivo {
  if (!userAgent) return "outro";
  if (/bot|crawler|spider|preview|curl|wget|python|okhttp/i.test(userAgent)) return "outro";
  if (/android|iphone|ipad|ipod|mobile|windows phone/i.test(userAgent)) return "mobile";
  if (/windows|macintosh|linux|cros/i.test(userAgent)) return "desktop";
  return "outro";
}

/** País vem do cabeçalho da Vercel; fora dela (localhost) fica vazio. */
export function paisDe(cabecalho: string | null): string | null {
  const pais = cabecalho?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(pais) ? pais : null;
}
