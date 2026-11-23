import { beforeEach, expect, it, vi } from "vitest";
import { confirmarCodigoRecuperacao, solicitarRecuperacao } from "@/app/recuperar-senha/acoes";
import { entrarComCodigo } from "@/app/entrar/acoes";
import { finalizarConfirmacao } from "@/app/auth/confirmar/acoes";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(), verificar: vi.fn(), sessao: vi.fn(), troca: vi.fn(), rpc: vi.fn(), cookies: new Map<string, string>(),
}));
vi.mock("@/lib/env", () => ({
  urlDoSiteParaLogin: () => "https://www.speedtag.online",
  envPublico: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave-publica-de-teste" }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "www.speedtag.online" }),
  cookies: async () => ({
    get: (nome: string) => (mocks.cookies.has(nome) ? { value: mocks.cookies.get(nome) } : undefined),
    set: (nome: string, valor: string) => mocks.cookies.set(nome, valor),
    delete: (nome: string) => mocks.cookies.delete(nome),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { resetPasswordForEmail: mocks.reset } }) }));
vi.mock("@/lib/supabase/servidor", () => ({
  clienteSupabaseUsuario: async () => ({
    auth: { verifyOtp: mocks.verificar, setSession: mocks.sessao, exchangeCodeForSession: mocks.troca },
    rpc: mocks.rpc,
  }),
  clienteSupabaseServico: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
}));

const empresas = "/painel/empresas?placa=SP75R1";
const tokens = { tipo: "sessao" as const, accessToken: "token-de-acesso-teste", refreshToken: "token-de-renovacao" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cookies.clear();
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

it("pede a recuperação sem PKCE, com retorno puro e o destino guardado em cookie", async () => {
  mocks.reset.mockResolvedValue({ error: null });
  const dados = new FormData();
  dados.set("email", "Pessoa@teste.dev");
  expect(await solicitarRecuperacao(empresas, { tipo: "inicial" }, dados)).toEqual({ tipo: "enviado", email: "pessoa@teste.dev" });
  expect(mocks.reset).toHaveBeenCalledWith("pessoa@teste.dev", { redirectTo: "https://www.speedtag.online/auth/confirmar" });
  expect(mocks.cookies.get("st_proximo")).toBe(empresas);
});

it("não confirma o envio quando o Supabase recusa a solicitação", async () => {
  mocks.reset.mockResolvedValue({ error: { status: 500, code: "unexpected_failure" } });
  const dados = new FormData();
  dados.set("email", "pessoa@teste.dev");
  expect(await solicitarRecuperacao(empresas, { tipo: "inicial" }, dados)).toMatchObject({ tipo: "erro" });
});

it("verifica o código de recuperação e preserva a placa no endereço da próxima tela", async () => {
  mocks.verificar.mockResolvedValue({ data: { user: { id: "cliente" }, session: {} }, error: null });
  const dados = new FormData();
  dados.set("codigo", "123456");
  await expect(confirmarCodigoRecuperacao(empresas, "pessoa@teste.dev", "", dados)).rejects.toMatchObject({
    digest: expect.stringContaining(`/recuperar-senha/nova?proximo=${encodeURIComponent(empresas)}`),
  });
  expect(mocks.verificar).toHaveBeenCalledWith({ email: "pessoa@teste.dev", token: "123456", type: "recovery" });
});

it("usa o código de acesso com a finalidade de login", async () => {
  mocks.verificar.mockResolvedValue({ data: { user: { id: "cliente" }, session: {} }, error: null });
  const dados = new FormData();
  dados.set("codigo", "012345");
  await expect(entrarComCodigo(empresas, "pessoa@teste.dev", "", dados)).rejects.toMatchObject({
    digest: expect.stringContaining(empresas),
  });
  expect(mocks.verificar).toHaveBeenCalledWith({ email: "pessoa@teste.dev", token: "012345", type: "email" });
});

it("não abre a sessão se o código estiver expirado", async () => {
  mocks.verificar.mockResolvedValue({ data: { user: null, session: null }, error: { status: 403, code: "otp_expired" } });
  const dados = new FormData();
  dados.set("codigo", "123456");
  expect(await confirmarCodigoRecuperacao(empresas, "pessoa@teste.dev", "", dados)).toMatch(/expirado/);
});

it("link de recuperação grava a sessão e segue para a nova senha com o destino guardado", async () => {
  mocks.cookies.set("st_proximo", empresas);
  mocks.sessao.mockResolvedValue({ data: { user: { id: "cliente", user_metadata: {} } }, error: null });
  expect(await finalizarConfirmacao({ ...tokens, fluxo: "recovery" })).toEqual({
    destino: `/recuperar-senha/nova?proximo=${encodeURIComponent(empresas)}`,
  });
  expect(mocks.sessao).toHaveBeenCalledWith({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
});

it("conta criada pelo NFC conclui a placa e vai criar a senha", async () => {
  mocks.sessao.mockResolvedValue({ data: { user: { id: "cliente", user_metadata: { senha_pendente: true } } }, error: null });
  mocks.rpc.mockImplementation(async (nome: string) =>
    nome === "speed_tag_concluir_ativacoes" ? { data: { ativadas: ["SP75R1"], recusadas: [] }, error: null } : { data: null, error: null });
  expect(await finalizarConfirmacao({ ...tokens, fluxo: "signup" })).toEqual({
    destino: `/criar-senha?proximo=${encodeURIComponent("/painel/empresas?ativada=SP75R1")}`,
  });
  expect(mocks.rpc).toHaveBeenCalledWith("speed_tag_concluir_ativacoes");
});

it("conta existente vincula a placa e entra direto, sem nova senha", async () => {
  mocks.sessao.mockResolvedValue({ data: { user: { id: "cliente", user_metadata: {} } }, error: null });
  mocks.rpc.mockImplementation(async (nome: string) =>
    nome === "speed_tag_concluir_ativacoes" ? { data: { ativadas: ["SP75R1"], recusadas: [] }, error: null } : { data: null, error: null });
  expect(await finalizarConfirmacao({ ...tokens, fluxo: "magiclink" })).toEqual({ destino: "/painel/empresas?ativada=SP75R1" });
});

it("recusa sessão inválida sem chamar o banco", async () => {
  mocks.sessao.mockResolvedValue({ data: { user: null }, error: { status: 401, code: "bad_jwt" } });
  expect(await finalizarConfirmacao({ ...tokens, fluxo: null })).toMatchObject({ erro: expect.stringMatching(/expirou/) });
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("recusa token_hash com finalidade desconhecida", async () => {
  expect(await finalizarConfirmacao({ tipo: "token_hash", tokenHash: "hash-de-teste-123", fluxo: "outra" })).toMatchObject({ erro: expect.any(String) });
  expect(mocks.verificar).not.toHaveBeenCalled();
});
