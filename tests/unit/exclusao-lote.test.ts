import { describe, expect, it } from "vitest";
import {
  FILTRO_PLACAS_EM_USO,
  avaliarExclusaoLote,
  descreverExclusaoLote,
  interpretarExclusaoLote,
  placaEmUso,
} from "@/lib/placas/exclusao-lote";

describe("regra de exclusão de lote", () => {
  it("placa em estoque, reservada ou desativada sem dono não bloqueia", () => {
    expect(placaEmUso({ status: "disponivel", dono_id: null })).toBe(false);
    expect(placaEmUso({ status: "reservada", dono_id: null })).toBe(false);
    expect(placaEmUso({ status: "desativada", dono_id: null })).toBe(false);
  });

  it("placa ativa, aguardando ativação ou com dono bloqueia", () => {
    expect(placaEmUso({ status: "ativa", dono_id: null })).toBe(true);
    expect(placaEmUso({ status: "atribuida", dono_id: null })).toBe(true);
    expect(placaEmUso({ status: "desativada", dono_id: "u1" })).toBe(true);
  });

  it("o filtro do banco cobre os mesmos casos", () => {
    expect(FILTRO_PLACAS_EM_USO).toBe("status.in.(ativa,atribuida),dono_id.not.is.null");
  });

  it("permite excluir sem placas em uso, inclusive lote vazio", () => {
    expect(avaliarExclusaoLote({ total: 50, emUso: 0 })).toEqual({ permitido: true });
    expect(avaliarExclusaoLote({ total: 0, emUso: 0 })).toEqual({ permitido: true });
  });

  it("bloqueia e mostra a contagem quando há placas em uso", () => {
    const uma = avaliarExclusaoLote({ total: 10, emUso: 1 });
    expect(uma.permitido).toBe(false);
    if (!uma.permitido) expect(uma.motivo).toContain("1 placa de 10 placas deste lote está ativa");

    const varias = avaliarExclusaoLote({ total: 1200, emUso: 3 });
    if (!varias.permitido) expect(varias.motivo).toContain("3 placas de 1.200 placas deste lote estão ativas");
    else throw new Error("deveria bloquear");
  });

  it("descreve o que acontece com as placas no diálogo", () => {
    expect(descreverExclusaoLote({ total: 0, nfcGravado: 0 })).toBe("O lote não tem placas. Só o lote será apagado.");
    expect(descreverExclusaoLote({ total: 1, nfcGravado: 0 })).toContain("1 placa do lote também será apagada");
    const comNfc = descreverExclusaoLote({ total: 20, nfcGravado: 2 });
    expect(comNfc).toContain("20 placas do lote também serão apagadas");
    expect(comNfc).toContain("2 placas já têm NFC gravado");
  });

  it("interpreta as respostas da função do banco", () => {
    expect(interpretarExclusaoLote({ ok: true, placas_apagadas: 5, nome: "Teste" })).toEqual({
      ok: true,
      mensagem: "Lote Teste excluído com 5 placas.",
      nome: "Teste",
      placasApagadas: 5,
    });
    const emUso = interpretarExclusaoLote({ ok: false, erro: "PLACAS_EM_USO", total: 8, em_uso: 2 });
    expect(emUso.ok).toBe(false);
    expect(emUso.mensagem).toContain("2 placas de 8 placas");
    expect(interpretarExclusaoLote({ ok: false, erro: "SEM_ACESSO" }).mensagem).toBe("Só administradores podem excluir lotes.");
    expect(interpretarExclusaoLote({ ok: false, erro: "LOTE_NAO_ENCONTRADO" }).ok).toBe(false);
    expect(interpretarExclusaoLote(null)).toEqual({ ok: false, mensagem: "Não foi possível excluir o lote." });
  });
});
