import { beforeEach, describe, expect, it, vi } from "vitest";
import { ativarComLink, pesquisarEmpresa, reivindicarTag } from "@/app/ativar/[codigo]/acoes";
import { gerarSegredoNfc, hashSegredoNfc } from "@/lib/placas/segredo-nfc";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), consulta: vi.fn(), rpc: vi.fn(), servicoRpc: vi.fn(), google: vi.fn(),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/google/gerador", () => ({ pesquisarNoGoogle: mocks.google }));
vi.mock("@/lib/supabase/servidor", () => ({
  clienteSupabaseUsuario: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: () => {
      const consulta = { select: () => consulta, eq: () => consulta, maybeSingle: mocks.consulta };
      return consulta;
    },
  }),
  clienteSupabaseServico: () => ({ rpc: mocks.servicoRpc }),
}));

const codigo = "NFC123";
const usuario = "11111111-1111-4111-8111-111111111111";
const url = "https://g.page/r/exemplo/review";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: usuario } } });
  mocks.consulta.mockResolvedValue({ data: { id: "placa" } });
});

describe("ativação com conta de cliente", () => {
  it("exige sessão antes da busca Google", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(await pesquisarEmpresa(codigo, "Loja")).toHaveProperty("erro");
    expect(mocks.google).not.toHaveBeenCalled();
  });

  it("exige placa atribuída e visível pela RLS antes da busca e da ativação", async () => {
    mocks.consulta.mockResolvedValue({ data: null });
    expect(await pesquisarEmpresa(codigo, "Loja")).toHaveProperty("erro");
    expect(await ativarComLink(codigo, "Loja", url)).toHaveProperty("erro");
    expect(mocks.google).not.toHaveBeenCalled();
    expect(mocks.servicoRpc).not.toHaveBeenCalled();
  });

  it("preserva a limitação de uso da busca Google", async () => {
    mocks.google.mockResolvedValue({ erro: "Cota excedida." });
    expect(await pesquisarEmpresa(codigo, "Loja")).toEqual({ erro: "Cota excedida." });
    expect(mocks.google).toHaveBeenCalledWith("Loja", expect.objectContaining({ usuarioId: usuario }));
  });

  it("usa o titular autenticado na ativação", async () => {
    mocks.servicoRpc.mockResolvedValue({ data: { ok: true } });
    expect(await ativarComLink(codigo, "Loja", url)).toEqual({ ativada: true, emailEnviado: false });
    expect(mocks.servicoRpc).toHaveBeenCalledWith("ativar_placa", {
      p_codigo: codigo, p_ator: usuario, p_origem: "manual", p_place_id: null, p_nome: "Loja", p_link: url,
    });
  });

  it("aplica o limite de placas informado pelo banco", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "LIMITE_PLACAS" } });
    const dados = new FormData();
    const segredo = gerarSegredoNfc();
    dados.set("segredo", segredo);
    expect(await reivindicarTag(codigo, "", dados)).toContain("limite");
    expect(mocks.rpc).toHaveBeenCalledWith("speed_tag_reivindicar_nfc", { p_codigo: codigo, p_hash: hashSegredoNfc(segredo) });
  });
});
