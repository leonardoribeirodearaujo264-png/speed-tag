import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/servidor", () => ({ clienteSupabaseUsuario: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (destino: string) => { throw new Error(destino); } }));
const { clienteSupabaseUsuario } = await import("@/lib/supabase/servidor");
const { destinoAposLogin, exigirAdmin } = await import("@/lib/auth");

const cliente = (admin: boolean) => ({ rpc: vi.fn(async () => ({ data: admin, error: null })) }) as never;

describe("destino depois do login", () => {
  it("ADM sem destino vai ao painel administrativo", async () => {
    expect(await destinoAposLogin(cliente(true), null)).toBe("/admin/placas");
    expect(await destinoAposLogin(cliente(true), "/painel/empresas")).toBe("/admin/placas");
  });
  it("cliente sem destino vai ao painel dele", async () => {
    expect(await destinoAposLogin(cliente(false), undefined)).toBe("/painel/empresas");
  });
  it("destino pedido (ativação de placa) vale para todos e bloqueia endereço externo", async () => {
    expect(await destinoAposLogin(cliente(true), "/ativar/A1B2C3")).toBe("/ativar/A1B2C3");
    expect(await destinoAposLogin(cliente(false), "//site-externo.com")).toBe("/painel/empresas");
  });
});

describe("rotas administrativas", () => {
  it.each(["/admin/lotes", "/admin/usuarios", "/admin/empresas"])("mantém o destino %s ao pedir a conta administrativa", async (rota) => {
    vi.mocked(clienteSupabaseUsuario).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "cliente" } } }) },
      rpc: async () => ({ data: false, error: null }),
    } as never);
    await expect(exigirAdmin(rota)).rejects.toThrow(`/admin/entrar?proximo=${encodeURIComponent(rota)}&erro=permissao`);
  });

  it("mantém o administrador na rota pedida", async () => {
    vi.mocked(clienteSupabaseUsuario).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
      rpc: async () => ({ data: true, error: null }),
    } as never);
    await expect(exigirAdmin("/admin/lotes")).resolves.toMatchObject({ usuarioId: "admin" });
  });
});
