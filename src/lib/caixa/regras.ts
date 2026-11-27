import { z } from "zod";
import type { CanalVenda, PagamentoVenda, ResumoCaixaBanco, StatusVenda } from "@/lib/supabase/tipos";

export const CANAIS: Record<CanalVenda, string> = {
  porta_a_porta: "Porta a porta",
  whatsapp: "WhatsApp",
  indicacao: "Indicação",
  outro: "Outro",
};
export const PAGAMENTOS: Record<PagamentoVenda, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão" };
export const STATUS_VENDA: Record<StatusVenda, string> = { pago: "Pago", pendente: "Pendente" };

export const PERIODOS = { hoje: "Hoje", "7dias": "7 dias", mes: "Este mês", tudo: "Tudo" } as const;
export type Periodo = keyof typeof PERIODOS;

export function periodoValido(valor: unknown): Periodo {
  return typeof valor === "string" && valor in PERIODOS ? (valor as Periodo) : "hoje";
}

/** Brasília não tem horário de verão desde 2019: UTC-3 fixo. */
const FUSO_MS = -3 * 60 * 60 * 1000;

/** Início do período no horário de Brasília, em ISO (null = tudo). */
export function inicioDoPeriodo(periodo: Periodo, agora = new Date()): string | null {
  if (periodo === "tudo") return null;
  const local = new Date(agora.getTime() + FUSO_MS);
  const ano = local.getUTCFullYear();
  const mes = local.getUTCMonth();
  const dia = local.getUTCDate();
  const inicioLocal =
    periodo === "mes" ? Date.UTC(ano, mes, 1) : periodo === "7dias" ? Date.UTC(ano, mes, dia - 6) : Date.UTC(ano, mes, dia);
  return new Date(inicioLocal - FUSO_MS).toISOString();
}

/** Aceita "97", "97,50", "1.234,56" e "11.13" (ponto decimal do teclado numérico). */
export function lerValor(entrada: unknown): number {
  if (typeof entrada !== "string") return Number.NaN;
  const texto = entrada.trim().replace(/\s|R\$/g, "");
  if (!texto) return Number.NaN;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  return /^\d+(\.\d{1,2})?$/.test(normalizado) ? Number(normalizado) : Number.NaN;
}

const valor = (rotulo: string) =>
  z.unknown().transform(lerValor).pipe(z.number({ error: `${rotulo} inválido.` }).min(0, `${rotulo} inválido.`).max(1_000_000, `${rotulo} acima do limite.`));
const quantidade = z.coerce.number({ error: "Quantidade inválida." }).int("Use um número inteiro.").min(1, "Informe ao menos 1.").max(100_000, "Quantidade acima do limite.");

export const esquemaVenda = z.object({
  id: z.uuid(),
  quantidade,
  valor_unitario: valor("Valor"),
  custo_unitario: valor("Custo"),
  canal: z.enum(Object.keys(CANAIS) as [CanalVenda, ...CanalVenda[]], { error: "Escolha o canal." }),
  pagamento: z.enum(Object.keys(PAGAMENTOS) as [PagamentoVenda, ...PagamentoVenda[]], { error: "Escolha o pagamento." }),
  status: z.enum(Object.keys(STATUS_VENDA) as [StatusVenda, ...StatusVenda[]], { error: "Escolha o status." }),
});

export const esquemaCompra = z.object({ id: z.uuid(), quantidade, custo_unitario: valor("Custo") });

/** Centavos para evitar erro de ponto flutuante nas somas da tela. */
export function totalVenda(qtd: number, valorUnitario: number, custoUnitario: number) {
  const total = Math.round(qtd * valorUnitario * 100) / 100;
  const custo = Math.round(qtd * custoUnitario * 100) / 100;
  return { total, custo, lucro: Math.round((total - custo) * 100) / 100 };
}

export type ResumoCaixa = {
  faturamento: number;
  custos: number;
  lucro: number;
  vendas: number;
  unidades: number;
  pendente: number;
  estoque: number;
  custoMedio: number;
};

export function montarResumo(banco: ResumoCaixaBanco | undefined): ResumoCaixa {
  const n = (v: unknown) => Number(v ?? 0) || 0;
  const faturamento = n(banco?.faturamento);
  const custos = n(banco?.custos);
  const comprado = n(banco?.comprado);
  return {
    faturamento,
    custos,
    lucro: Math.round((faturamento - custos) * 100) / 100,
    vendas: n(banco?.vendas),
    unidades: n(banco?.unidades),
    pendente: n(banco?.pendente),
    estoque: comprado - n(banco?.vendido),
    custoMedio: comprado > 0 ? Math.round((n(banco?.custo_compras) / comprado) * 100) / 100 : 0,
  };
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatarMoeda(valorReais: number): string {
  return moeda.format(valorReais).replace(/ /g, " ");
}

export type ModeloVenda = { quantidade: number; valor_unitario: number; custo_unitario: number; canal: CanalVenda; pagamento: PagamentoVenda; status: StatusVenda };
export type ModeloCompra = { quantidade: number; custo_unitario: number };

/**
 * Atalhos de lançamento: combinações já usadas, da mais recente para a mais antiga, sem
 * repetir. Recebe os lançamentos em ordem decrescente de data.
 */
export function modelosRecentes<T extends object>(lancamentos: readonly T[], campos: readonly (keyof T)[], limite = 4): T[] {
  const vistos = new Set<string>();
  const modelos: T[] = [];
  for (const item of lancamentos) {
    const chave = campos.map((c) => String(item[c])).join("|");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    modelos.push(Object.fromEntries(campos.map((c) => [c, item[c]])) as T);
    if (modelos.length === limite) break;
  }
  return modelos;
}

/** Valor no formato do campo: 97 -> "97,00"; zero fica vazio. */
export function valorParaCampo(v: number): string {
  return v > 0 ? v.toFixed(2).replace(".", ",") : "";
}
