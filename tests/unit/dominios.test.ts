import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { linkEscreverAvaliacao, linkGooglePermitido } from "@/lib/google/dominios";

const permitidos = [
  "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
  "https://www.google.com/maps/place/Loja/@-22.7,-47.6,17z",
  "https://www.google.com.br/maps?cid=123",
  "https://maps.google.com/?cid=123",
  "https://g.page/r/CbX1abc/review",
  "https://maps.app.goo.gl/STGaKrqTYp7yVe8V6",
  "https://goo.gl/maps/abc123",
];

const recusados = [
  "http://search.google.com/local/writereview?placeid=x",
  "https://search.google.com.golpe.com/local/writereview",
  "https://google.com.golpe.com/maps",
  "https://www.google.com/search?q=loja",
  "https://goo.gl/abc123",
  "https://evil.com/?r=https://g.page/r/x",
  "https://user:senha@g.page/r/x",
  "javascript:alert(1)",
  "nao e url",
  `https://g.page/${"a".repeat(2100)}`,
];

describe("linkGooglePermitido", () => {
  it.each(permitidos)("aceita %s", (link) => {
    expect(linkGooglePermitido(link)).toBe(true);
  });

  it.each(recusados)("recusa %s", (link) => {
    expect(linkGooglePermitido(link)).toBe(false);
  });
});

describe("paridade com public.link_avaliacao_valido()", () => {
  // Extrai a regex da migration e roda em JS: as construções usadas
  // (alternância, grupos, âncoras, classes) têm a mesma semântica no Postgres.
  const sql = readFileSync("supabase/migrations/20261123000000_placas.sql", "utf8");
  const bloco = sql.match(/coalesce\(p_link, ''\) ~ \(([\s\S]*?)\r?\n  \)\r?\n/);
  if (!bloco) throw new Error("regex de link_avaliacao_valido não encontrada na migration");
  const padrao = [...bloco[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).join("");
  const regexSql = new RegExp(padrao);
  const validoNoBanco = (link: string) => regexSql.test(link) && link.length <= 2048;

  it.each([...permitidos, ...recusados.filter((l) => !l.includes("@"))])(
    "banco e app concordam em %s",
    (link) => {
      expect(validoNoBanco(link)).toBe(linkGooglePermitido(link));
    },
  );
});

describe("linkEscreverAvaliacao", () => {
  it("monta o link do formulário de avaliação", () => {
    expect(linkEscreverAvaliacao("ChIJ abc")).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJ%20abc",
    );
  });
});
