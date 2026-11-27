/** Escuro no painel do cliente, claro no painel do ADM. */
export type TemaCaixa = "escuro" | "claro";

export const ESTILOS_CAIXA: Record<TemaCaixa, {
  cartao: string; texto: string; suave: string; divisor: string; lucro: string; negativo: string; pendente: string;
  periodo: string; periodoAtivo: string; periodoInativo: string; foco: string; erro: string;
}> = {
  escuro: {
    cartao: "rounded-2xl border border-slate-700 bg-slate-900",
    texto: "text-white",
    suave: "text-slate-400",
    divisor: "divide-slate-800 border-slate-800",
    lucro: "text-emerald-300",
    negativo: "text-red-300",
    pendente: "text-amber-300",
    periodo: "bg-slate-900",
    periodoAtivo: "bg-white text-slate-900",
    periodoInativo: "text-slate-300 hover:bg-white/10",
    foco: "focus-visible:ring-cyan-300",
    erro: "border-red-900 bg-red-950 text-red-200",
  },
  claro: {
    cartao: "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    texto: "text-slate-900",
    suave: "text-slate-500",
    divisor: "divide-slate-100 border-slate-100",
    lucro: "text-emerald-600",
    negativo: "text-red-600",
    pendente: "text-amber-600",
    periodo: "bg-slate-100",
    periodoAtivo: "bg-white text-slate-900 shadow-sm",
    periodoInativo: "text-slate-600 hover:bg-white/60",
    foco: "focus-visible:ring-marca",
    erro: "border-red-200 bg-red-50 text-red-700",
  },
};
