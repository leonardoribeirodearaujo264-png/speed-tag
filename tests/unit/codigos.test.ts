import { describe, expect, it } from "vitest";
import {
  ALFABETO_CODIGO,
  TAMANHO_CODIGO,
  codigoValido,
  gerarCodigo,
  gerarCodigos,
  normalizarCodigo,
} from "@/lib/codigos";

describe("códigos de placa", () => {
  it("alfabeto tem 32 símbolos sem I, L, O, U", () => {
    expect(ALFABETO_CODIGO).toHaveLength(32);
    expect(ALFABETO_CODIGO).not.toMatch(/[ILOU]/);
  });

  it("gera códigos válidos de 6 caracteres", () => {
    for (let i = 0; i < 1000; i++) {
      const codigo = gerarCodigo();
      expect(codigo).toHaveLength(TAMANHO_CODIGO);
      expect(codigoValido(codigo)).toBe(true);
    }
  });

  it("gera lote sem repetição", () => {
    const codigos = gerarCodigos(5000);
    expect(new Set(codigos).size).toBe(5000);
  });

  it("recusa quantidade fora de 1 a 10000", () => {
    expect(() => gerarCodigos(0)).toThrow(RangeError);
    expect(() => gerarCodigos(10_001)).toThrow(RangeError);
    expect(() => gerarCodigos(1.5)).toThrow(RangeError);
  });

  it("normaliza o que a pessoa digita", () => {
    expect(normalizarCodigo(" a1b-2c3 ")).toBe("A1B2C3");
    expect(normalizarCodigo("oil0ab")).toBe("0110AB");
    expect(normalizarCodigo("OIL")).toBe("011");
  });

  it("valida o formato", () => {
    expect(codigoValido("A1B2C3")).toBe(true);
    expect(codigoValido("A1B2C")).toBe(false);
    expect(codigoValido("A1B2CU")).toBe(false);
    expect(codigoValido("a1b2c3")).toBe(false);
  });

  it("distribui os símbolos sem viés grosseiro", () => {
    const contagem = new Map<string, number>();
    const amostra = gerarCodigos(10_000).join("");
    for (const c of amostra) contagem.set(c, (contagem.get(c) ?? 0) + 1);
    const esperado = amostra.length / 32;
    expect(contagem.size).toBe(32);
    for (const n of contagem.values()) {
      expect(n).toBeGreaterThan(esperado * 0.8);
      expect(n).toBeLessThan(esperado * 1.2);
    }
  });
});
