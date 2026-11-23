import { afterEach, describe, expect, it, vi } from "vitest";

const validas = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x".repeat(40),
  SUPABASE_SECRET_KEY: "y".repeat(40),
  GOOGLE_PLACES_API_KEY: "z".repeat(39),
};

async function carregar() {
  vi.resetModules();
  return import("@/lib/env");
}

function aplicar(valores: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(valores)) vi.stubEnv(k, v);
}

afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("servidor não exige a chave do Google", async () => {
    aplicar({ ...validas, GOOGLE_PLACES_API_KEY: undefined });
    const { envServidor } = await carregar();
    expect(envServidor().SUPABASE_SECRET_KEY).toBe(validas.SUPABASE_SECRET_KEY);
  });

  it("servidor falha dizendo que falta a secret key", async () => {
    aplicar({ ...validas, SUPABASE_SECRET_KEY: "" });
    const { envServidor } = await carregar();
    expect(() => envServidor()).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("Google aplica a região padrão e acusa chave ausente", async () => {
    aplicar({ ...validas, PLACES_REGIAO_PADRAO: undefined });
    const { envGoogle } = await carregar();
    expect(envGoogle().PLACES_REGIAO_PADRAO).toBe("br");

    aplicar({ GOOGLE_PLACES_API_KEY: "" });
    const recarregado = await carregar();
    expect(() => recarregado.envGoogle()).toThrow(/GOOGLE_PLACES_API_KEY/);
  });

  it("confirmação de e-mail fica desligada salvo se for exatamente true", async () => {
    const { exigeConfirmacaoEmail } = await carregar();
    vi.stubEnv("EXIGIR_CONFIRMACAO_EMAIL", undefined);
    expect(exigeConfirmacaoEmail()).toBe(false);
    vi.stubEnv("EXIGIR_CONFIRMACAO_EMAIL", "sim");
    expect(exigeConfirmacaoEmail()).toBe(false);
    vi.stubEnv("EXIGIR_CONFIRMACAO_EMAIL", "true");
    expect(exigeConfirmacaoEmail()).toBe(true);
  });

  it("na produção da Vercel, troca endereço localhost pelo domínio de produção", async () => {
    aplicar({ ...validas, NEXT_PUBLIC_SITE_URL: "http://localhost:3210", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "speed-tag.vercel.app" });
    const { urlDoSite } = await carregar();
    expect(urlDoSite()).toBe("https://speed-tag.vercel.app");
  });

  it("mantém o endereço configurado quando ele é público ou fora da produção", async () => {
    aplicar({ ...validas, NEXT_PUBLIC_SITE_URL: "https://meudominio.com.br/", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "speed-tag.vercel.app" });
    expect((await carregar()).urlDoSite()).toBe("https://meudominio.com.br");
    aplicar({ NEXT_PUBLIC_SITE_URL: "http://localhost:3210", VERCEL_ENV: "preview" });
    expect((await carregar()).urlDoSite()).toBe("http://localhost:3210");
  });

  it("valida as públicas sem exigir as do servidor", async () => {
    aplicar({ ...validas, SUPABASE_SECRET_KEY: "" });
    const { envPublico } = await carregar();
    expect(envPublico().NEXT_PUBLIC_SUPABASE_URL).toBe(validas.NEXT_PUBLIC_SUPABASE_URL);
  });

  it("mantém o host público que iniciou a autenticação e ignora hosts desconhecidos", async () => {
    aplicar({ ...validas, NEXT_PUBLIC_SITE_URL: "https://www.speedtag.online" });
    const { urlDoSiteParaLogin } = await carregar();
    expect(urlDoSiteParaLogin("speedtag.online")).toBe("https://speedtag.online");
    expect(urlDoSiteParaLogin("www.speedtag.online")).toBe("https://www.speedtag.online");
    expect(urlDoSiteParaLogin("speedtag.online.exemplo.dev")).toBe("https://www.speedtag.online");
  });
});
