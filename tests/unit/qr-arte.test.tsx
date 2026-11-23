import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { ArtePlaca } from "@/components/placa/arte-placa";
import { fundoArteDataUri } from "@/lib/placas/fundo-arte";
import { NOMES_MODELOS } from "@/lib/placas/modelos-arte";
import { gerarQrPng, gerarQrSvg, qrDaArte } from "@/lib/placas/qr";
import { urlNfc, urlQr } from "@/lib/placas/urls";

const BASE = "https://placa.exemplo.com";

describe("URLs da placa", () => {
  it("NFC sem parâmetro e QR com o=q", () => {
    expect(urlNfc("A1B2C3", BASE)).toBe("https://placa.exemplo.com/t/A1B2C3");
    expect(urlQr("A1B2C3", BASE)).toBe("https://placa.exemplo.com/t/A1B2C3?o=q");
  });
});

describe("QR", () => {
  it("codifica exatamente a URL da placa, com correção Q", () => {
    const url = urlQr("A1B2C3", BASE);
    const qr = QRCode.create(url, { errorCorrectionLevel: "Q" });
    const conteudo = qr.segments.map((s) => String(s.data instanceof Uint8Array ? new TextDecoder().decode(s.data) : s.data)).join("");
    expect(conteudo).toBe(url);
  });

  it("gera SVG e PNG válidos", async () => {
    const svg = await gerarQrSvg(urlQr("A1B2C3", BASE));
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
    const png = await gerarQrPng(urlQr("A1B2C3", BASE), 512);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(512);
  });

  it("limita o tamanho do PNG", async () => {
    const png = await gerarQrPng("x", 99_999);
    expect(png.readUInt32BE(16)).toBe(4096);
  });
});

describe("arte da placa no Satori (PNG)", () => {
  it.each(NOMES_MODELOS)("modelo %s: renderiza com a arte do cliente e gera PNG do tamanho pedido", async (modelo) => {
    const { ImageResponse } = await import("next/og");
    const qr = await qrDaArte(urlQr("A1B2C3", BASE));
    const fundo = await fundoArteDataUri(modelo);
    expect(fundo.startsWith("data:image/jpeg;base64,")).toBe(true);
    const resposta = new ImageResponse(<ArtePlaca codigo="A1B2C3" qrDataUri={qr} tamanho={1000} modelo={modelo} fundo={fundo} />, {
      width: 1000,
      height: 1000,
    });
    const png = Buffer.from(await resposta.arrayBuffer());
    expect(png.readUInt32BE(16)).toBe(1000);

    // Guarda a prévia para conferência visual.
    const pasta = join(tmpdir(), "placa-avaliacao");
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, `arte-A1B2C3-${modelo}.png`), png);
  }, 30_000);
});
