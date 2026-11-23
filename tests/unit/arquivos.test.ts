import { describe, expect, it } from "vitest";
import { gerarCsv } from "@/lib/arquivos/csv";
import { crc32, criarZip } from "@/lib/arquivos/zip";

describe("crc32", () => {
  it("bate com o valor de referência", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("criarZip", () => {
  it("monta assinaturas, diretório central e conteúdo legível", () => {
    const zip = criarZip([
      { nome: "A1B2C3.svg", conteudo: "<svg/>" },
      { nome: "ção.txt", conteudo: "olá" },
    ]);
    const dv = new DataView(zip.buffer);

    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    const fim = zip.length - 22;
    expect(dv.getUint32(fim, true)).toBe(0x06054b50);
    expect(dv.getUint16(fim + 10, true)).toBe(2);

    const inicioCentral = dv.getUint32(fim + 16, true);
    expect(dv.getUint32(inicioCentral, true)).toBe(0x02014b50);

    // Primeiro arquivo: cabeçalho local (30) + nome (10) e depois os dados crus.
    const dados = new TextDecoder().decode(zip.slice(30 + 10, 30 + 10 + 6));
    expect(dados).toBe("<svg/>");
    expect(dv.getUint32(14, true)).toBe(crc32(new TextEncoder().encode("<svg/>")));
  });
});

describe("gerarCsv", () => {
  it("usa ponto e vírgula, BOM e escapa campos", () => {
    const csv = gerarCsv(["codigo", "obs"], [["A1B2C3", 'tem; e "aspas"']]);
    expect(csv.startsWith("﻿codigo;obs\r\n")).toBe(true);
    expect(csv).toContain('A1B2C3;"tem; e ""aspas"""');
  });

  it("neutraliza fórmula no início da célula", () => {
    expect(gerarCsv(["x"], [["=HYPERLINK(1)"]])).toContain("'=HYPERLINK(1)");
  });
});
