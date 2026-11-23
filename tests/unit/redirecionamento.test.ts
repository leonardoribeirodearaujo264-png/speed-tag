import { describe, expect, it } from "vitest";
import { dispositivoDe, origemDaLeitura, paisDe } from "@/lib/placas/redirecionamento";

describe("origemDaLeitura", () => {
  it("QR tem o=q; NFC não tem parâmetro", () => {
    expect(origemDaLeitura(new URLSearchParams("o=q"))).toBe("qr");
    expect(origemDaLeitura(new URLSearchParams(""))).toBe("nfc");
    expect(origemDaLeitura(new URLSearchParams("o=x"))).toBe("nfc");
  });
});

describe("dispositivoDe", () => {
  it.each([
    ["Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36", "mobile"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15", "mobile"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131", "desktop"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15", "desktop"],
    ["WhatsApp/2.24 preview bot", "outro"],
    ["curl/8.5.0", "outro"],
  ])("%s -> %s", (ua, esperado) => {
    expect(dispositivoDe(ua)).toBe(esperado);
  });

  it("sem user agent é outro", () => {
    expect(dispositivoDe(null)).toBe("outro");
  });
});

describe("paisDe", () => {
  it("aceita só duas letras", () => {
    expect(paisDe("br")).toBe("BR");
    expect(paisDe("BRA")).toBeNull();
    expect(paisDe(null)).toBeNull();
    expect(paisDe("")).toBeNull();
  });
});
