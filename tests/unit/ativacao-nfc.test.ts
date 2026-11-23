import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmarEmpresaNfc, pesquisarEmpresaNfc } from "@/app/ativar/[codigo]/acoes";
import { gerarSegredoNfc, hashSegredoNfc } from "@/lib/placas/segredo-nfc";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  usuarioRpc: vi.fn(),
  servicoRpc: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/servidor", () => ({
  clienteSupabaseUsuario: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.usuarioRpc }),
  clienteSupabaseServico: () => ({ rpc: mocks.servicoRpc }),
}));

const codigo = "NFC123";
const usuario = "11111111-1111-4111-8111-111111111111";
const segredo = gerarSegredoNfc();
const placeId = "ChIJAmostra";
const destino = "https://www.google.com/maps/place/exemplo";

describe("ativação de tag NFC", () => {
  const fetchGoogle = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-exclusiva-para-teste-local");
    vi.stubGlobal("fetch", fetchGoogle);
    mocks.getUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null });
    mocks.usuarioRpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("normaliza o segredo sem guardar o valor em claro", () => {
    expect(segredo.replaceAll("-", "")).toHaveLength(32);
    expect(hashSegredoNfc(segredo.toLowerCase().replaceAll("-", " "))).toBe(hashSegredoNfc(segredo));
    expect(hashSegredoNfc("código-público")).toBeNull();
  });

  it("não consulta o Google sem sessão autenticada", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await pesquisarEmpresaNfc(codigo, segredo, "Loja de teste")).toHaveProperty("erro");
    expect(mocks.servicoRpc).not.toHaveBeenCalled();
    expect(fetchGoogle).not.toHaveBeenCalled();
  });

  it("não consulta o Google quando o banco nega o acesso", async () => {
    mocks.servicoRpc.mockResolvedValue({ data: "negada", error: null });
    expect(await pesquisarEmpresaNfc(codigo, segredo, "Loja de teste")).toHaveProperty("erro");
    expect(fetchGoogle).not.toHaveBeenCalled();
  });

  it("pesquisa apenas após validar a credencial e retorna opções com endereço", async () => {
    mocks.servicoRpc.mockResolvedValue({ data: "ok", error: null });
    fetchGoogle.mockResolvedValue(Response.json({
      places: [{ id: placeId, displayName: { text: "Loja de teste" }, formattedAddress: "Rua de teste, 10" }],
    }));
    expect(await pesquisarEmpresaNfc(codigo, segredo, "Loja de teste")).toEqual({
      empresas: [{ id: placeId, nome: "Loja de teste", endereco: "Rua de teste, 10" }],
    });
    expect(mocks.servicoRpc).toHaveBeenCalledWith("placas_consultar_nfc", {
      p_codigo: codigo, p_ator: usuario, p_hash: hashSegredoNfc(segredo),
    });
    expect(fetchGoogle).toHaveBeenCalledWith("https://places.googleapis.com/v1/places:searchText",
      expect.objectContaining({ method: "POST" }));
  });

  it("salva o link de avaliação vindo do Google com o usuário da sessão", async () => {
    mocks.servicoRpc.mockResolvedValueOnce({ data: "ok", error: null }).mockResolvedValueOnce({ data: true, error: null });
    fetchGoogle.mockResolvedValue(Response.json({
      id: placeId, displayName: { text: "Loja de teste" }, googleMapsLinks: { writeAReviewUri: destino },
    }));
    expect(await confirmarEmpresaNfc(codigo, segredo, placeId)).toEqual({ ativada: true });
    expect(mocks.servicoRpc).toHaveBeenLastCalledWith("placas_ativar_nfc", {
      p_codigo: codigo, p_ator: usuario, p_hash: hashSegredoNfc(segredo),
      p_place_id: placeId, p_nome: "Loja de teste", p_link: destino,
    });
  });

  it("não altera a placa se o Google falhar", async () => {
    mocks.servicoRpc.mockResolvedValue({ data: "ok", error: null });
    fetchGoogle.mockResolvedValue(new Response(null, { status: 403 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await confirmarEmpresaNfc(codigo, segredo, placeId)).toHaveProperty("erro");
      expect(mocks.servicoRpc).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
});
