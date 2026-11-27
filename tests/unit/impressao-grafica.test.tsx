import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { EtiquetaQr, POSICOES_CODIGO, posicaoCodigo } from "@/components/placa/etiqueta-qr";
import { ladoPxGrafica } from "@/app/admin/(painel)/impressao/pngs-zip";
import { dpiDoPng, pngComDpi } from "@/lib/arquivos/png";
import { criarZip } from "@/lib/arquivos/zip";
import { gerarQrPng, gerarQrSvg, qrDaEtiqueta } from "@/lib/placas/qr";
import { urlQr } from "@/lib/placas/urls";

const BASE = "https://www.speedtag.online";

describe("PNG com dpi para a gráfica", () => {
  it("grava 300 dpi depois do IHDR e mantém a imagem", async () => {
    const original = new Uint8Array(await gerarQrPng("teste", 256));
    expect(dpiDoPng(original)).toBeNull();
    const comDpi = pngComDpi(original, 300);
    expect(dpiDoPng(comDpi)).toBe(300);
    expect(comDpi.length).toBe(original.length + 21);
    // O chunk entra logo depois do IHDR (8 + 25 bytes).
    expect(new TextDecoder().decode(comDpi.subarray(37, 41))).toBe("pHYs");
  });

  it("substitui um pHYs que já existia e ignora o que não é PNG", async () => {
    const duas = pngComDpi(pngComDpi(new Uint8Array(await gerarQrPng("x", 128)), 72), 300);
    expect(dpiDoPng(duas)).toBe(300);
    expect(new TextDecoder().decode(duas).split("pHYs").length - 1).toBe(1);
    const lixo = new Uint8Array([1, 2, 3]);
    expect(pngComDpi(lixo, 300)).toBe(lixo);
  });

  it("lado em px a 300 dpi para cada tamanho da folha", () => {
    expect(ladoPxGrafica(8)).toBe(945);
    expect(ladoPxGrafica(3)).toBe(354);
    expect(ladoPxGrafica(10)).toBe(1181);
  });

  it("ZIP com um arquivo por código", () => {
    const zip = criarZip([{ nome: "AB12CD.png", conteudo: new Uint8Array([1]) }, { nome: "XY34ZW.png", conteudo: new Uint8Array([2]) }]);
    const texto = new TextDecoder().decode(zip);
    expect(texto).toContain("AB12CD.png");
    expect(texto).toContain("XY34ZW.png");
  });
});

describe("etiqueta só de QR", () => {
  it("posição: só 'meio' muda; qualquer outra coisa é embaixo", () => {
    expect(posicaoCodigo("meio")).toBe("meio");
    expect(posicaoCodigo("x")).toBe("embaixo");
    expect(posicaoCodigo(null)).toBe("embaixo");
  });

  it("com o código no meio o QR usa correção H; embaixo, Q", async () => {
    const url = urlQr("AB12CD", BASE);
    const meio = Buffer.from((await qrDaEtiqueta(url, true)).split(",")[1], "base64").toString();
    const embaixo = Buffer.from((await qrDaEtiqueta(url, false)).split(",")[1], "base64").toString();
    expect(meio).toBe(await gerarQrSvg(url, { nivel: "H" }));
    expect(embaixo).toBe(await gerarQrSvg(url, { nivel: "Q" }));
    expect(QRCode.create(url, { errorCorrectionLevel: "H" }).errorCorrectionLevel.bit).toBe(2);
  });

  it.each(POSICOES_CODIGO)("código %s: gera PNG no Satori (prévia salva para o leitor de QR)", async (posicao) => {
    const { ImageResponse } = await import("next/og");
    const pasta = join(tmpdir(), "placa-avaliacao");
    mkdirSync(pasta, { recursive: true });
    for (const lado of [354, 945]) {
      const qr = await qrDaEtiqueta(urlQr("AB12CD", BASE), posicao === "meio");
      const resposta = new ImageResponse(<EtiquetaQr codigo="AB12CD" qrDataUri={qr} tamanho={lado} posicao={posicao} />, { width: lado, height: lado });
      const png = Buffer.from(await resposta.arrayBuffer());
      expect(png.readUInt32BE(16)).toBe(lado);
      writeFileSync(join(pasta, `etiqueta-${posicao}-${lado}.png`), png);
    }
  }, 30_000);
});
