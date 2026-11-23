import { describe, expect, it } from "vitest";
import { lerUrlMaps, resolverLinkGoogle, urlGoogleSegura, verificarLinkAvaliacao, type Buscador } from "@/lib/google/links-maps";

const PLACE = "ChIJN1t_tDeuEmsRUsoyG83frY4";

describe("urlGoogleSegura", () => {
  it("aceita links do Google, com ou sem https", () => {
    expect(urlGoogleSegura("maps.app.goo.gl/AbC123")?.toString()).toBe("https://maps.app.goo.gl/AbC123");
    expect(urlGoogleSegura("http://www.google.com/maps/place/X")?.protocol).toBe("https:");
  });

  it("recusa o que pode virar SSRF ou sair do Google", () => {
    for (const ruim of [
      "https://evil.com/maps",
      "https://www.google.com.evil.com/maps",
      "https://169.254.169.254/latest",
      "https://localhost/maps",
      "https://www.google.com:8443/maps",
      "https://user:senha@www.google.com/maps",
      "ftp://www.google.com/maps",
      "javascript:alert(1)",
      "",
    ]) {
      expect(urlGoogleSegura(ruim), ruim).toBeNull();
    }
  });
});

describe("lerUrlMaps", () => {
  it("pega o Place ID de writereview, query_place_id e q=place_id", () => {
    expect(lerUrlMaps(new URL(`https://search.google.com/local/writereview?placeid=${PLACE}`)).placeId).toBe(PLACE);
    expect(lerUrlMaps(new URL(`https://www.google.com/maps/search/?api=1&query=X&query_place_id=${PLACE}`)).placeId).toBe(PLACE);
    expect(lerUrlMaps(new URL(`https://maps.google.com/?q=place_id:${PLACE}`)).placeId).toBe(PLACE);
  });

  it("pega o Place ID dentro de data=!19s", () => {
    const url = new URL(`https://www.google.com/maps/place/Padaria+Fran%C3%A7a/@-22.72,-47.64,17z/data=!3m1!4b1!4m6!3m5!1s0x94c631:0x1a2b!8m2!3d-22.7251!4d-47.6493!16s%2Fg%2F11abc!19s${PLACE}?entry=ttu`);
    const d = lerUrlMaps(url);
    expect(d.placeId).toBe(PLACE);
    expect(d.nome).toBe("Padaria França");
    expect(d.latitude).toBeCloseTo(-22.7251);
    expect(d.longitude).toBeCloseTo(-47.6493);
  });

  it("sem Place ID, devolve nome e coordenadas para a busca aproximada", () => {
    const d = lerUrlMaps(new URL("https://www.google.com/maps/place/Sueli+Pereira+da+Silva/@-23.39,-51.87,15z"));
    expect(d.placeId).toBeUndefined();
    expect(d).toMatchObject({ nome: "Sueli Pereira da Silva", latitude: -23.39, longitude: -51.87 });
  });

  it("usa q como nome e ignora q com coordenadas", () => {
    expect(lerUrlMaps(new URL("https://maps.google.com/?q=Pizzaria+Bella+Sarandi")).nome).toBe("Pizzaria Bella Sarandi");
    const c = lerUrlMaps(new URL("https://maps.google.com/?q=-23.4,-51.9"));
    expect(c.nome).toBeUndefined();
    expect(c.latitude).toBe(-23.4);
  });
});

function falso(rotas: Record<string, { status: number; location?: string }>): { buscar: Buscador; chamadas: string[] } {
  const chamadas: string[] = [];
  const buscar: Buscador = async (url) => {
    chamadas.push(url);
    const r = rotas[url];
    if (!r) throw new Error(`inesperado: ${url}`);
    return new Response(null, { status: r.status, headers: r.location ? { location: r.location } : {} });
  };
  return { buscar, chamadas };
}

describe("resolverLinkGoogle", () => {
  it("segue o link curto até o Maps", async () => {
    const final = `https://www.google.com/maps/place/X/data=!19s${PLACE}`;
    const { buscar } = falso({
      "https://maps.app.goo.gl/AbC": { status: 302, location: final },
      [final]: { status: 200 },
    });
    const r = await resolverLinkGoogle(new URL("https://maps.app.goo.gl/AbC"), buscar);
    expect(r.ok && r.url.toString()).toBe(final);
  });

  it("não segue redirecionamento para fora do Google", async () => {
    const { buscar, chamadas } = falso({ "https://maps.app.goo.gl/AbC": { status: 302, location: "http://169.254.169.254/" } });
    const r = await resolverLinkGoogle(new URL("https://maps.app.goo.gl/AbC"), buscar);
    expect(r).toEqual({ ok: false, motivo: "FORA_DO_GOOGLE" });
    expect(chamadas).toHaveLength(1);
  });

  it("trata login e consentimento do Google como destino final", async () => {
    const { buscar } = falso({
      "https://search.google.com/local/writereview?placeid=X": { status: 302, location: "https://accounts.google.com/ServiceLogin?continue=x" },
    });
    const r = await resolverLinkGoogle(new URL("https://search.google.com/local/writereview?placeid=X"), buscar);
    expect(r.ok && r.terminal).toBe(true);
  });

  it("para depois de muitos saltos", async () => {
    const { buscar } = falso({ "https://g.page/a": { status: 302, location: "https://g.page/a" } });
    expect(await resolverLinkGoogle(new URL("https://g.page/a"), buscar)).toEqual({ ok: false, motivo: "SALTOS_DEMAIS" });
  });
});

describe("verificarLinkAvaliacao", () => {
  it("reprova 404 e aceita indisponibilidade temporária como não verificado", async () => {
    const { buscar } = falso({
      "https://maps.app.goo.gl/morto": { status: 404 },
      "https://maps.app.goo.gl/lento": { status: 429 },
    });
    expect((await verificarLinkAvaliacao("https://maps.app.goo.gl/morto", buscar)).estado).toBe("invalido");
    expect((await verificarLinkAvaliacao("https://maps.app.goo.gl/lento", buscar)).estado).toBe("nao_verificado");
    expect((await verificarLinkAvaliacao("https://evil.com/x", buscar)).estado).toBe("invalido");
  });
});

describe("linkAvaliacaoSeguro", () => {
  it("usa o writeAReviewUri real do Google e cai no formulário oficial se vier algo fora do Google", async () => {
    const { linkAvaliacaoSeguro } = await import("@/lib/google/places");
    const real = "https://www.google.com/maps/place//data=!4m3!3m2!1s0x6b12ae665e892fdd:0x3133f8d75a1ac251!12e1?g_mp=CiVnb29n";
    expect(linkAvaliacaoSeguro(PLACE, real)).toBe(real);
    expect(linkAvaliacaoSeguro(PLACE, "https://evil.com/x")).toBe(`https://search.google.com/local/writereview?placeid=${PLACE}`);
    expect(linkAvaliacaoSeguro(PLACE)).toContain(PLACE);
  });
});
