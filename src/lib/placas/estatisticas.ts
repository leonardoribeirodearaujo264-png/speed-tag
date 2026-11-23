export type LeituraBruta = { ocorrida_em: string; origem: "nfc" | "qr" | "desconhecida" };
export type PontoSerie = { dia: string; nfc: number; qr: number };

const FUSO = "America/Sao_Paulo";
const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia civil (YYYY-MM-DD) no fuso de Brasília. */
export function diaLocal(data: Date): string {
  return formatoDia.format(data);
}

/**
 * Série diária dos últimos `dias` dias (hoje incluso), com zeros nos dias sem leitura.
 * Mesma regra do painel: tudo que não é NFC conta como QR.
 */
export function montarSerie(leituras: LeituraBruta[], dias: number, agora: Date): PontoSerie[] {
  const serie: PontoSerie[] = [];
  const indice = new Map<string, PontoSerie>();
  for (let i = dias - 1; i >= 0; i--) {
    const ponto = { dia: diaLocal(new Date(agora.getTime() - i * 86_400_000)), nfc: 0, qr: 0 };
    if (indice.has(ponto.dia)) continue;
    indice.set(ponto.dia, ponto);
    serie.push(ponto);
  }
  for (const l of leituras) {
    const ponto = indice.get(diaLocal(new Date(l.ocorrida_em)));
    if (!ponto) continue;
    if (l.origem === "nfc") ponto.nfc++;
    else ponto.qr++;
  }
  return serie;
}
