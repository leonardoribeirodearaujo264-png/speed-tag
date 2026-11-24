import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/placas/urls", () => ({ urlQr: (codigo: string) => `https://placa.exemplo.com/t/${codigo}?o=q` }));
import { ladoDaArte, respostaArtePlaca } from "@/lib/placas/resposta-arte";

describe("tamanho da arte pedida pela folha em PDF", () => {
  it("aceita de 300 a 2000 px e cai em 2000 fora disso", () => {
    expect(ladoDaArte("640")).toBe(640);
    expect(ladoDaArte("300")).toBe(300);
    expect(ladoDaArte(null)).toBe(2000);
    expect(ladoDaArte("50")).toBe(2000);
    expect(ladoDaArte("99999")).toBe(2000);
    expect(ladoDaArte("abc")).toBe(2000);
  });

  it("gera o PNG no tamanho pedido", async () => {
    const resposta = await respostaArtePlaca("A1B2C3", "azul", false, 640);
    const png = Buffer.from(await resposta.arrayBuffer());
    expect(png.readUInt32BE(16)).toBe(640);
    expect(png.readUInt32BE(20)).toBe(640);
  }, 30_000);
});
