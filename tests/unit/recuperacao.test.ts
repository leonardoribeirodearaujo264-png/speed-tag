import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { solicitarRecuperacao } from "@/app/recuperar-senha/acoes";
import { GET } from "@/app/auth/confirmar/route";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(), exchange: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ urlDoSiteParaLogin: () => "https://www.speedtag.online" }));
vi.mock("@/lib/supabase/servidor", () => ({
  clienteSupabaseUsuario: async () => ({
    auth: { resetPasswordForEmail: mocks.reset, exchangeCodeForSession: mocks.exchange },
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
  expect(await solicitarRecuperacao(empresas, { tipo: "inicial" }, dados)).toEqual({ tipo: "enviado" });
  const callback = new URL("/auth/confirmar", origem);
  callback.searchParams.set("recuperar", "1");
  callback.searchParams.set("proximo", empresas);
  expect(mocks.reset).toHaveBeenCalledWith("pessoa@teste.dev", { redirectTo: callback.toString() });
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
