import { describe, expect, it } from "vitest";
import { esquemaCompra, esquemaVenda, formatarMoeda, inicioDoPeriodo, lerValor, modelosRecentes, montarResumo, periodoValido, totalVenda, valorParaCampo } from "@/lib/caixa/regras";

const ID = "6d100a1b-0a9d-4340-9784-8d949666d7a6";

describe("valores digitados", () => {
  it("aceita vírgula, ponto decimal, milhar e R$", () => {
    expect(lerValor("97")).toBe(97);
    expect(lerValor("11,13")).toBe(11.13);
    expect(lerValor("11.13")).toBe(11.13);
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("R$ 97,00")).toBe(97);
  });
  it("recusa texto, negativo e mais de 2 casas", () => {
    for (const v of ["", "abc", "-5", "1,234", "1.2.3", undefined]) expect(lerValor(v)).toBeNaN();
  });
});

describe("venda e compra", () => {
  const venda = { id: ID, quantidade: "1", valor_unitario: "97", custo_unitario: "11,13", canal: "porta_a_porta", pagamento: "pix", status: "pago" };
  it("valida a venda do exemplo e converte os números", () => {
    expect(esquemaVenda.parse(venda)).toEqual({ ...venda, quantidade: 1, valor_unitario: 97, custo_unitario: 11.13 });
  });
  it("recusa quantidade zero, canal desconhecido e id inválido", () => {
    expect(esquemaVenda.safeParse({ ...venda, quantidade: "0" }).success).toBe(false);
    expect(esquemaVenda.safeParse({ ...venda, quantidade: "1.5" }).success).toBe(false);
    expect(esquemaVenda.safeParse({ ...venda, canal: "instagram" }).success).toBe(false);
    expect(esquemaVenda.safeParse({ ...venda, id: "x" }).success).toBe(false);
    expect(esquemaVenda.safeParse({ ...venda, valor_unitario: "abc" }).error?.issues[0].message).toBe("Valor inválido.");
  });
  it("compra precisa de quantidade e custo", () => {
    expect(esquemaCompra.parse({ id: ID, quantidade: "311", custo_unitario: "11,13" })).toEqual({ id: ID, quantidade: 311, custo_unitario: 11.13 });
    expect(esquemaCompra.safeParse({ id: ID, quantidade: "", custo_unitario: "1" }).success).toBe(false);
  });
  it("total e lucro em centavos (sem erro de ponto flutuante)", () => {
    expect(totalVenda(1, 97, 11.13)).toEqual({ total: 97, custo: 11.13, lucro: 85.87 });
    expect(totalVenda(3, 0.1, 0.2)).toEqual({ total: 0.3, custo: 0.6, lucro: -0.3 });
  });
});

describe("resumo", () => {
  it("estoque = compras - vendas; custo médio das compras", () => {
    const r = montarResumo({ faturamento: 97, custos: 11.13, vendas: 1, unidades: 1, pendente: 0, comprado: 311, vendido: 1, custo_compras: 3461.43 });
    expect(r).toMatchObject({ lucro: 85.87, estoque: 310, custoMedio: 11.13 });
  });
  it("sem dados tudo zera", () => {
    expect(montarResumo(undefined)).toMatchObject({ faturamento: 0, lucro: 0, estoque: 0, custoMedio: 0 });
  });
  it("moeda em reais", () => {
    expect(formatarMoeda(85.87)).toBe("R$ 85,87");
  });
});

describe("períodos no horário de Brasília", () => {
  // 26/11/2026 01:30 em Brasília = 04:30 UTC.
  const agora = new Date("2026-11-26T04:30:00Z");
  it("hoje começa à meia-noite de Brasília", () => {
    expect(inicioDoPeriodo("hoje", agora)).toBe("2026-11-26T03:00:00.000Z");
  });
  it("7 dias inclui hoje e os 6 anteriores; mês começa no dia 1", () => {
    expect(inicioDoPeriodo("7dias", agora)).toBe("2026-11-20T03:00:00.000Z");
    expect(inicioDoPeriodo("mes", agora)).toBe("2026-11-01T03:00:00.000Z");
    expect(inicioDoPeriodo("tudo", agora)).toBeNull();
  });
  it("às 23h de Brasília ainda é o mesmo dia (UTC já virou)", () => {
    expect(inicioDoPeriodo("hoje", new Date("2026-11-27T02:00:00Z"))).toBe("2026-11-26T03:00:00.000Z");
  });
  it("período inválido vira hoje", () => {
    expect(periodoValido("ano")).toBe("hoje");
    expect(periodoValido(["mes"])).toBe("hoje");
    expect(periodoValido("mes")).toBe("mes");
  });
});

describe("atalhos \"Usados antes\"", () => {
  const v = (quantidade: number, valor_unitario: number, canal = "pix") => ({ quantidade, valor_unitario, custo_unitario: 11.13, canal });
  it("mais recentes primeiro, sem repetir a mesma combinação, no máximo 4", () => {
    const lista = [v(1, 97), v(1, 97), v(2, 90), v(1, 97, "dinheiro"), v(3, 85), v(5, 80), v(1, 97)];
    const modelos = modelosRecentes(lista, ["quantidade", "valor_unitario", "custo_unitario", "canal"]);
    expect(modelos).toEqual([v(1, 97), v(2, 90), v(1, 97, "dinheiro"), v(3, 85)]);
  });
  it("só os campos pedidos entram no modelo; lista vazia não gera atalho", () => {
    expect(modelosRecentes([{ quantidade: 311, custo_unitario: 11.13, id: "x" }], ["quantidade", "custo_unitario"])).toEqual([{ quantidade: 311, custo_unitario: 11.13 }]);
    expect(modelosRecentes([], ["quantidade"])).toEqual([]);
  });
  it("valor volta para o campo com vírgula", () => {
    expect(valorParaCampo(97)).toBe("97,00");
    expect(valorParaCampo(11.13)).toBe("11,13");
    expect(valorParaCampo(0)).toBe("");
  });
});

describe("botão de compra pelo WhatsApp", async () => {
  const { linkWhatsappCompra } = await import("@/lib/contato");
  it("abre o número de vendas com a mensagem pronta", () => {
    expect(linkWhatsappCompra()).toBe("https://wa.me/5511966218520?text=Ol%C3%A1%2C%20tenho%20interesse%20em%20mais%20plaquinhas.");
  });
});
