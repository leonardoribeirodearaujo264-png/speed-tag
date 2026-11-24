import type { StatusPlaca } from "@/lib/supabase/tipos";

/**
 * Regra de exclusão de lote (espelha public.speed_tag_excluir_lote, migração 0025):
 * o lote só pode ser apagado quando nenhuma placa dele está ativa, aguardando ativação
 * ou com dono. As demais placas (em estoque, reservadas, desativadas sem dono) são apagadas junto.
 */

const STATUS_EM_USO: readonly StatusPlaca[] = ["ativa", "atribuida"];

/** Filtro PostgREST equivalente a placaEmUso, para contar no banco. */
export const FILTRO_PLACAS_EM_USO = `status.in.(${STATUS_EM_USO.join(",")}),dono_id.not.is.null`;

export function placaEmUso(placa: { status: StatusPlaca; dono_id: string | null }): boolean {
  return STATUS_EM_USO.includes(placa.status) || placa.dono_id !== null;
}

export type SituacaoExclusaoLote = { permitido: true } | { permitido: false; motivo: string };

function placas(n: number): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "placa" : "placas"}`;
}

export function avaliarExclusaoLote(contagem: { total: number; emUso: number }): SituacaoExclusaoLote {
  if (contagem.emUso <= 0) return { permitido: true };
  const verbo = contagem.emUso === 1 ? "está ativa, aguardando ativação ou com cliente" : "estão ativas, aguardando ativação ou com cliente";
  return {
    permitido: false,
    motivo: `${placas(contagem.emUso)} de ${placas(contagem.total)} deste lote ${verbo}. Devolva ao estoque ou mova para outro lote antes de excluir.`,
  };
}

/** Texto do diálogo de confirmação: quantas placas vão junto e o que acontece com elas. */
export function descreverExclusaoLote(contagem: { total: number; nfcGravado: number }): string {
  if (contagem.total === 0) return "O lote não tem placas. Só o lote será apagado.";
  const nfc =
    contagem.nfcGravado > 0
      ? ` ${placas(contagem.nfcGravado)} já ${contagem.nfcGravado === 1 ? "tem" : "têm"} NFC gravado: o NFC e o QR Code delas deixam de funcionar.`
      : "";
  return `${placas(contagem.total)} do lote também ${contagem.total === 1 ? "será apagada" : "serão apagadas"}, com leituras e histórico.${nfc} Isso não tem volta.`;
}

type RespostaExclusao = { ok: boolean; erro?: string; total?: number; em_uso?: number; placas_apagadas?: number; nome?: string };

export type ResultadoExclusaoLote =
  | { ok: true; mensagem: string; nome: string; placasApagadas: number }
  | { ok: false; mensagem: string };

/** Aviso mostrado na lista depois da exclusão. */
export function mensagemLoteExcluido(nome: string, placasApagadas: number): string {
  return `Lote ${nome} excluído com ${placas(placasApagadas)}.`;
}

/** Converte o jsonb devolvido por speed_tag_excluir_lote em mensagem para a tela. */
export function interpretarExclusaoLote(dados: unknown): ResultadoExclusaoLote {
  const r = (dados ?? {}) as RespostaExclusao;
  if (r.ok) {
    const nome = r.nome ?? "";
    const placasApagadas = r.placas_apagadas ?? 0;
    return { ok: true, mensagem: mensagemLoteExcluido(nome, placasApagadas), nome, placasApagadas };
  }
  switch (r.erro) {
    case "PLACAS_EM_USO": {
      const situacao = avaliarExclusaoLote({ total: r.total ?? 0, emUso: r.em_uso ?? 1 });
      return { ok: false, mensagem: situacao.permitido ? "O lote mudou. Recarregue a página." : situacao.motivo };
    }
    case "LOTE_NAO_ENCONTRADO":
      return { ok: false, mensagem: "Lote não encontrado. Ele pode já ter sido excluído." };
    case "SEM_ACESSO":
      return { ok: false, mensagem: "Só administradores podem excluir lotes." };
    default:
      return { ok: false, mensagem: "Não foi possível excluir o lote." };
  }
}
