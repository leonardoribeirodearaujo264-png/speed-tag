import { describe, expect, it, vi } from "vitest";
import { criarLote } from "@/lib/placas/criacao";

function supabaseFalso() {
  const chamadas: { rpc: string; args: Record<string, unknown> }[] = [];
  const updates: Record<string, unknown>[] = [];
  const cliente = {
    rpc: vi.fn(async (rpc: string, args: Record<string, unknown>) => {
      chamadas.push({ rpc, args });
      return rpc === "criar_lote" ? { data: "lote-1", error: null } : { data: 1, error: null };
    }),
    from: () => ({ update: (dados: Record<string, unknown>) => { updates.push(dados); return { eq: async () => ({ error: null }) }; } }),
  };
  return { cliente: cliente as never, chamadas, updates };
}

describe("lote com placas de cores diferentes", () => {
  it("cria 50 azuis e 50 pretas no mesmo lote, cada placa com a sua cor", async () => {
    const { cliente, chamadas } = supabaseFalso();
    const r = await criarLote(cliente, { nome: "Misto", quantidades: { azul: 50, preta: 50 }, revendedor: null });
    expect(r).toEqual({ ok: true, dado: { loteId: "lote-1" } });
    const criacao = chamadas.find((c) => c.rpc === "criar_lote")!;
    const codigos = criacao.args.p_codigos as string[];
    expect(codigos).toHaveLength(100);
    const cores = chamadas.filter((c) => c.rpc === "speed_tag_definir_cor_placas");
    expect(cores.map((c) => [c.args.p_modelo, (c.args.p_codigos as string[]).length])).toEqual([["azul", 50], ["preta", 50]]);
    const todos = cores.flatMap((c) => c.args.p_codigos as string[]);
    expect(new Set(todos).size).toBe(100);
    expect(todos.sort()).toEqual([...codigos].sort());
  });

  it("lote de uma cor só usa a cor do lote, sem gravar cor em cada placa", async () => {
    const { cliente, chamadas, updates } = supabaseFalso();
    await criarLote(cliente, { nome: "Pretas", quantidades: { azul: 0, preta: 30 }, revendedor: null });
    expect(chamadas.some((c) => c.rpc === "speed_tag_definir_cor_placas")).toBe(false);
    expect(updates).toEqual([{ modelo_arte: "preta" }]);
  });

  it("a cor principal do lote misto é a que tem mais placas", async () => {
    const { cliente, updates } = supabaseFalso();
    await criarLote(cliente, { nome: "Mais pretas", quantidades: { azul: 10, preta: 40 }, revendedor: null });
    expect(updates).toEqual([{ modelo_arte: "preta" }]);
  });
});
