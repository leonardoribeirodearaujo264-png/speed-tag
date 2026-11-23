import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ativarComGoogle, ativarComLink, pesquisarEmpresa } from "@/app/ativar/[codigo]/acoes";
import { linkEscreverAvaliacao } from "@/lib/google/dominios";
import { gerarSegredoNfc, hashSegredoNfc } from "@/lib/placas/segredo-nfc";

const mocks = vi.hoisted(() => ({
  servicoRpc: vi.fn(),
  placa: vi.fn(),
  upsert: vi.fn(),
  createUser: vi.fn(),
  signInWithOtp: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { signInWithOtp: mocks.signInWithOtp } }) }));
vi.mock("@/lib/supabase/servidor", () => ({
  clienteSupabaseServico: () => ({
    rpc: mocks.servicoRpc,
    auth: { admin: { createUser: mocks.createUser } },
    from: (tabela: string) =>
      tabela === "perfis"
        ? { upsert: mocks.upsert }
        : { select: () => ({ eq: () => ({ maybeSingle: mocks.placa }) }) },
  }),
}));

const codigo = "A1B2C3";
const usuario = "11111111-1111-4111-8111-111111111111";
const placeId = "ChIJAmostra";
const env = {
  NEXT_PUBLIC_SITE_URL: "https://speed-tag.vercel.app",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x".repeat(40),
  GOOGLE_PLACES_API_KEY: "chave-exclusiva-para-teste-local",
};

/** Respostas do servidor: usuario_por_email devolve a conta; ativar_placa_cliente devolve o resultado. */
function rpcCom(ativacao: unknown, conta: string | null = usuario) {
  mocks.servicoRpc.mockImplementation(async (nome: string) =>
    nome === "usuario_por_email" ? { data: conta, error: null } : { data: ativacao, error: null },
  );
}

describe("ativação pelo cliente (fluxo do vídeo)", () => {
  const fetchGoogle = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    vi.stubGlobal("fetch", fetchGoogle);
    mocks.placa.mockResolvedValue({ data: { status: "disponivel" }, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.signInWithOtp.mockResolvedValue({ error: null });
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

  it("busca a empresa sem login quando a placa está livre", async () => {
    fetchGoogle.mockResolvedValue(
      Response.json({ places: [{ id: placeId, displayName: { text: "Loja de teste" }, formattedAddress: "Rua de teste, 10" }] }),
    );
    expect(await pesquisarEmpresa(codigo, "Loja de teste")).toEqual({
      empresas: [{ id: placeId, nome: "Loja de teste", endereco: "Rua de teste, 10" }],
    });
  });

  it("não consulta o Google para placa já ativa ou reservada", async () => {
    for (const status of ["ativa", "reservada", "desativada"]) {
      mocks.placa.mockResolvedValue({ data: { status }, error: null });
      expect(await pesquisarEmpresa(codigo, "Loja de teste")).toHaveProperty("erro");
    }
    expect(fetchGoogle).not.toHaveBeenCalled();
  });

  it("ativa com o e-mail de uma conta existente e o link gerado no servidor", async () => {
    rpcCom({ ok: true });
    expect(await ativarComGoogle(codigo, "Ana@Teste.dev", placeId, "Loja de teste")).toEqual({ ativada: true, emailEnviado: true });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.servicoRpc).toHaveBeenCalledWith("ativar_placa_cliente", {
      p_codigo: codigo,
      p_ator: usuario,
      p_origem: "google_places",
      p_place_id: placeId,
      p_nome: "Loja de teste",
      p_link: linkEscreverAvaliacao(placeId),
    });
  });

  it("cria a conta quando o e-mail é novo", async () => {
    rpcCom({ ok: true }, null);
    mocks.createUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null });
    expect(await ativarComLink(codigo, "nova@teste.dev", "Loja", "https://g.page/r/loja/review")).toEqual({ ativada: true, emailEnviado: true });
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "nova@teste.dev", email_confirm: true }));
  });

  it("informa quando o e-mail de acesso não pôde ser enviado", async () => {
    rpcCom({ ok: true });
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await ativarComLink(codigo, "ana@teste.dev", "Loja", "https://g.page/r/loja/review")).toEqual({ ativada: true, emailEnviado: false });
    } finally {
      log.mockRestore();
    }
  });

  it("recusa link manual fora do Google sem tocar no banco", async () => {
    expect(await ativarComLink(codigo, "ana@teste.dev", "Loja", "https://site-falso.com/review")).toHaveProperty("erro");
    expect(mocks.servicoRpc).not.toHaveBeenCalled();
  });

  it("mostra o motivo quando o banco recusa", async () => {
    rpcCom({ ok: false, erro: "NAO_E_SUA" });
    expect(await ativarComLink(codigo, "ana@teste.dev", "Loja", "https://g.page/r/loja/review")).toEqual({
      erro: "Esta placa já pertence a outra conta. Use o e-mail do dono da placa.",
    });
  });
});
