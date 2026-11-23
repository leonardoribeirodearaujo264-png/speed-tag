/**
 * Wrapper tipado da Web NFC (Chrome para Android, contexto seguro HTTPS).
 * A API não está no lib.dom do TypeScript, então os tipos mínimos ficam aqui.
 */
type RegistroNdef = { recordType: string; data?: DataView; encoding?: string };
type EventoLeitura = Event & { serialNumber: string; message: { records: RegistroNdef[] } };

type LeitorNdef = EventTarget & {
  write(mensagem: { records: Array<{ recordType: "url"; data: string }> }, opcoes?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void>;
  scan(opcoes?: { signal?: AbortSignal }): Promise<void>;
  makeReadOnly(opcoes?: { signal?: AbortSignal }): Promise<void>;
};

type ConstrutorLeitor = new () => LeitorNdef;

function construtor(): ConstrutorLeitor | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { NDEFReader?: ConstrutorLeitor }).NDEFReader ?? null);
}

export function nfcSuportado(): boolean {
  return construtor() !== null && window.isSecureContext;
}

export type ErroNfc = "SEM_SUPORTE" | "PERMISSAO_NEGADA" | "TEMPO_ESGOTADO" | "CHIP_TRAVADO" | "FALHA";

export class FalhaNfc extends Error {
  constructor(public readonly tipo: ErroNfc, detalhe?: string) {
    super(detalhe ?? tipo);
  }
}

function traduzirErro(erro: unknown): FalhaNfc {
  if (erro instanceof FalhaNfc) return erro;
  const nome = erro instanceof DOMException ? erro.name : "";
  if (nome === "NotAllowedError") return new FalhaNfc("PERMISSAO_NEGADA");
  if (nome === "AbortError" || nome === "TimeoutError") return new FalhaNfc("TEMPO_ESGOTADO");
  if (nome === "NotSupportedError") return new FalhaNfc("SEM_SUPORTE");
  // Chip já travado recusa escrita com NetworkError/InvalidStateError dependendo do aparelho.
  if (nome === "InvalidStateError") return new FalhaNfc("CHIP_TRAVADO");
  return new FalhaNfc("FALHA", erro instanceof Error ? erro.message : String(erro));
}

function novoLeitor(): LeitorNdef {
  const Leitor = construtor();
  if (!Leitor || !window.isSecureContext) throw new FalhaNfc("SEM_SUPORTE");
  return new Leitor();
}

const TEMPO_LIMITE_MS = 30_000;

/** Grava a URL no chip. Resolve quando a gravação termina; o usuário precisa aproximar o chip. */
export async function gravarUrl(url: string): Promise<void> {
  try {
    await novoLeitor().write(
      { records: [{ recordType: "url", data: url }] },
      { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) },
    );
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/** Lê o próximo chip aproximado e devolve a primeira URL gravada nele (ou null). */
export async function lerUrl(): Promise<string | null> {
  const leitor = novoLeitor();
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    return await new Promise<string | null>((resolver, rejeitar) => {
      leitor.addEventListener(
        "reading",
        (evento) => {
          const registros = (evento as EventoLeitura).message.records;
          const url = registros.find((r) => r.recordType === "url" && r.data);
          resolver(url?.data ? new TextDecoder().decode(url.data) : null);
        },
        { once: true },
      );
      leitor.addEventListener("readingerror", () => rejeitar(new FalhaNfc("FALHA", "leitura falhou")), {
        once: true,
      });
      controle.signal.addEventListener("abort", () => rejeitar(new FalhaNfc("TEMPO_ESGOTADO")), { once: true });
      leitor.scan({ signal: controle.signal }).catch(rejeitar);
    });
  } catch (erro) {
    throw traduzirErro(erro);
  } finally {
    clearTimeout(limite);
    controle.abort();
  }
}

/** Trava o chip para sempre. Irreversível. */
export async function travarChip(): Promise<void> {
  try {
    await novoLeitor().makeReadOnly({ signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

export const MENSAGEM_ERRO_NFC: Record<ErroNfc, string> = {
  SEM_SUPORTE: "Este navegador não grava NFC. Use o Chrome no Android com o NFC ligado.",
  PERMISSAO_NEGADA: "Permissão de NFC negada. Libere o NFC para este site nas configurações do Chrome.",
  TEMPO_ESGOTADO: "Nenhum chip encostou a tempo. Tente de novo e segure o chip parado atrás do celular.",
  CHIP_TRAVADO: "Este chip já está travado e não aceita nova gravação.",
  FALHA: "Falha ao falar com o chip. Afaste, aproxime de novo e mantenha parado.",
};
