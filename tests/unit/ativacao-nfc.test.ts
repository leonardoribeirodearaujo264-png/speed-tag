import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ativarComGoogle, ativarComLink, identificarEmail, pesquisarEmpresa } from "@/app/ativar/[codigo]/acoes";
import { linkEscreverAvaliacao } from "@/lib/google/dominios";
import { gerarSegredoNfc, hashSegredoNfc } from "@/lib/placas/segredo-nfc";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  servicoRpc: vi.fn(),
  placa: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/servidor", () => ({
  clienteSupabaseUsuario: async () => ({ auth: { getUser: mocks.getUser }, rpc: vi.fn() }),
  clienteSupabaseServico: () => ({
    rpc: mocks.servicoRpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.placa }) }) }),
  }),
}));

const codigo = "A1B2C3";
const usuario = "11111111-1111-4111-8111-111111111111";
const outro = "22222222-2222-4222-8222-222222222222";
const placeId = "ChIJAmostra";
const livre = { status: "disponivel", dono_id: null, preparada_nfc: false, nfc_entregue_em: null };

describe("ativação pelo cliente", () => {
  const fetchGoogle = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-exclusiva-para-teste-local");
    vi.stubGlobal("fetch", fetchGoogle);
    mocks.getUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null });
    mocks.placa.mockResolvedValue({ data: livre, error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("o segredo de entrega é normalizado e guardado só como hash", () => {
    const segredo = gerarSegredoNfc();
    expect(hashSegredoNfc(segredo.toLowerCase().replaceAll("-", " "))).toBe(hashSegredoNfc(segredo));
    expect(hashSegredoNfc("código-público")).toBeNull();
  });

  it("e-mail com conta vai para entrar; sem conta, para criar", async () => {
    mocks.servicoRpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect(await identificarEmail("Ana@Teste.dev")).toEqual({ tipo: "entrar" });
    expect(await identificarEmail("nova@teste.dev")).toEqual({ tipo: "criar" });
    expect(mocks.servicoRpc).toHaveBeenNthCalledWith(1, "email_tem_conta", { p_email: "ana@teste.dev" });
  });

  it("não consulta o Google sem login", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await pesquisarEmpresa(codigo, "Loja de teste")).toHaveProperty("erro");
    expect(fetchGoogle).not.toHaveBeenCalled();
  });

  it("não consulta o Google se a placa é de outra conta", async () => {
    mocks.placa.mockResolvedValue({ data: { ...livre, status: "atribuida", dono_id: outro }, error: null });
    expect(await pesquisarEmpresa(codigo, "Loja de teste")).toHaveProperty("erro");
    expect(fetchGoogle).not.toHaveBeenCalled();
  });

  it("pesquisa no Google quando a placa está livre", async () => {
    fetchGoogle.mockResolvedValue(
      Response.json({ places: [{ id: placeId, displayName: { text: "Loja de teste" }, formattedAddress: "Rua de teste, 10" }] }),
    );
    expect(await pesquisarEmpresa(codigo, "Loja de teste")).toEqual({
      empresas: [{ id: placeId, nome: "Loja de teste", endereco: "Rua de teste, 10" }],
    });
  });

  it("ativa pelo Google com o link gerado no servidor a partir do Place ID", async () => {
    mocks.servicoRpc.mockResolvedValue({ data: { ok: true }, error: null });
    expect(await ativarComGoogle(codigo, placeId, "Loja de teste")).toEqual({ ativada: true });
    expect(mocks.servicoRpc).toHaveBeenCalledWith("ativar_placa_cliente", {
      p_codigo: codigo,
      p_ator: usuario,
      p_origem: "google_places",
      p_place_id: placeId,
      p_nome: "Loja de teste",
      p_link: linkEscreverAvaliacao(placeId),
    });
    expect(fetchGoogle).not.toHaveBeenCalled();
  });

  it("recusa link manual fora do Google sem tocar no banco", async () => {
    expect(await ativarComLink(codigo, "Loja", "https://site-falso.com/review")).toHaveProperty("erro");
    expect(mocks.servicoRpc).not.toHaveBeenCalled();
  });

  it("mostra o motivo quando o banco recusa", async () => {
    mocks.servicoRpc.mockResolvedValue({ data: { ok: false, erro: "NAO_E_SUA" }, error: null });
    expect(await ativarComLink(codigo, "Loja", "https://g.page/r/loja/review")).toEqual({
      erro: "Esta placa já pertence a outra conta ou ainda não foi liberada.",
    });
  });
});
