import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { confirmarCodigoRecuperacao, solicitarRecuperacao } from "@/app/recuperar-senha/acoes";
import { entrarComCodigo } from "@/app/entrar/acoes";
import { GET } from "@/app/auth/confirmar/route";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(), exchange: vi.fn(), rpc: vi.fn(), verificar: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ urlDoSiteParaLogin: () => "https://www.speedtag.online" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "www.speedtag.online" }) }));
vi.mock("@/lib/supabase/servidor", () => ({
  clienteSupabaseUsuario: async () => ({
    auth: { resetPasswordForEmail: mocks.reset, exchangeCodeForSession: mocks.exchange, verifyOtp: mocks.verificar },
    rpc: mocks.rpc,
  }),
}));

const empresas = "/painel/empresas?placa=SP75R1";
const origem = "https://www.speedtag.online";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
});

it("solicita recuperação preservando a placa escaneada no retorno", async () => {
  mocks.reset.mockResolvedValue({ error: null });
  const dados = new FormData();
  dados.set("email", "Pessoa@teste.dev");
  expect(await solicitarRecuperacao(empresas, { tipo: "inicial" }, dados)).toEqual({ tipo: "enviado", email: "pessoa@teste.dev" });
  const callback = new URL("/auth/confirmar", origem);
  callback.searchParams.set("recuperar", "1");
  callback.searchParams.set("proximo", empresas);
  expect(mocks.reset).toHaveBeenCalledWith("pessoa@teste.dev", { redirectTo: callback.toString() });
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
  expect(mocks.rpc).toHaveBeenCalledWith("garantir_perfil");
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
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("uma sessão de recuperação segue para a tela de nova senha", async () => {
  mocks.exchange.mockResolvedValue({ data: { redirectType: "recovery" }, error: null });
  const callback = new URL("/auth/confirmar", origem);
  callback.searchParams.set("recuperar", "1");
  callback.searchParams.set("code", "codigo-de-teste");
  callback.searchParams.set("sb_flow_id", "fluxo-de-teste");
  callback.searchParams.set("proximo", empresas);
  const resposta = await GET(new NextRequest(callback));
  expect(mocks.exchange).toHaveBeenCalledWith("codigo-de-teste", { flowId: "fluxo-de-teste" });
  const destino = new URL(resposta.headers.get("location")!);
  expect(destino.pathname).toBe("/recuperar-senha/nova");
  expect(destino.searchParams.get("proximo")).toBe(empresas);
});

it("recusa um código de login como link de recuperação", async () => {
  mocks.exchange.mockResolvedValue({ data: { redirectType: null }, error: null });
  const resposta = await GET(new NextRequest(`${origem}/auth/confirmar?recuperar=1&code=codigo-de-teste`));
  const destino = new URL(resposta.headers.get("location")!);
  expect(destino.pathname).toBe("/recuperar-senha");
  expect(destino.searchParams.get("erro")).toBe("link");
});

it("o primeiro acesso abre Empresas com a placa da leitura", async () => {
  mocks.exchange.mockResolvedValue({ data: { redirectType: null }, error: null });
  const callback = new URL("/auth/confirmar", origem);
  callback.searchParams.set("code", "codigo-de-teste");
  callback.searchParams.set("proximo", empresas);
  const resposta = await GET(new NextRequest(callback));
  expect(resposta.headers.get("location")).toBe(`${origem}${empresas}`);
});
