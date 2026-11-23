import { describe, expect, it } from "vitest";
import { diaLocal, montarSerie } from "@/lib/placas/estatisticas";

describe("montarSerie", () => {
  const agora = new Date("2026-11-23T15:00:00Z");

  it("gera um ponto por dia, terminando hoje, com zeros", () => {
    const serie = montarSerie([], 30, agora);
    expect(serie).toHaveLength(30);
    expect(serie.at(-1)).toEqual({ dia: "2026-11-23", nfc: 0, qr: 0 });
    expect(serie[0]?.dia).toBe("2026-10-25");
  });

  it("separa NFC e QR e usa o fuso de Brasília", () => {
    const serie = montarSerie(
      [
        { ocorrida_em: "2026-11-23T12:00:00Z", origem: "nfc" },
        { ocorrida_em: "2026-11-23T02:30:00Z", origem: "qr" }, // 22/11 23:30 em Brasília
        { ocorrida_em: "2026-11-22T20:00:00Z", origem: "desconhecida" },
        { ocorrida_em: "2026-01-01T12:00:00Z", origem: "nfc" }, // fora da janela
      ],
      7,
      agora,
    );
    expect(serie.at(-1)).toEqual({ dia: "2026-11-23", nfc: 1, qr: 0 });
    expect(serie.at(-2)).toEqual({ dia: "2026-11-22", nfc: 0, qr: 2 });
  });

  it("formata o dia local", () => {
    expect(diaLocal(new Date("2026-11-24T02:00:00Z"))).toBe("2026-11-23");
  });
});
