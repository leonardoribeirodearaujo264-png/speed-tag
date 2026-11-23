import type { ComponentType, ReactNode } from "react";
import { cn } from "cn";

/** Peças visuais compartilhadas pelas telas do admin. */

/** Campo de formulário do admin: 44 px de altura (toque) e foco com a cor da marca. */
export const classeCampo =
  "h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-marca focus:ring-4 focus:ring-marca/15 disabled:bg-slate-50 disabled:text-slate-500";

/** Select de barra de filtros: largura total no celular, natural a partir do sm. */
export const classeSelectFiltro =
  "h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-marca focus:ring-4 focus:ring-marca/15 sm:w-auto";

/** Campo de busca com ícone à esquerda (o ícone fica num wrapper relative). */
export const classeBusca =
  "h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-marca focus:ring-4 focus:ring-marca/15";

export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  sobretitulo,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  sobretitulo?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {sobretitulo && <div className="mb-1 text-sm font-medium text-marca-texto">{sobretitulo}</div>}
        <h1 className="text-2xl font-semibold tracking-tight break-words text-slate-900 sm:text-[28px]">{titulo}</h1>
        {descricao && <p className="mt-1.5 text-[15px] text-slate-500">{descricao}</p>}
      </div>
      {/* No celular as ações ocupam a linha inteira e dividem o espaço; não cortam nem estouram. */}
      {acoes && <div className="flex w-full flex-wrap items-center gap-2 max-sm:*:grow sm:w-auto">{acoes}</div>}
    </div>
  );
}

export function Painel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      {children}
    </section>
  );
}

export function TituloPainel({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-5 pb-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

type Tom = "azul" | "verde" | "ambar" | "cinza";

const TONS: Record<Tom, string> = {
  azul: "bg-marca-claro text-marca-texto ring-marca-borda",
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  ambar: "bg-amber-50 text-amber-700 ring-amber-100",
  cinza: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function CartaoIndicador({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  tom = "azul",
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: ReactNode;
  icone: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tom?: Tom;
}) {
  return (
    <Painel className="min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{rotulo}</p>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl ring-1", TONS[tom])}>
          <Icone className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold sm:text-3xl tracking-tight text-slate-900 tabular-nums">
        {typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}
      </p>
      {detalhe && <p className="mt-1 text-sm text-slate-500">{detalhe}</p>}
    </Painel>
  );
}

export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acoes,
}: {
  icone: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  titulo: string;
  descricao: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-14">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-marca-claro ring-1 ring-marca-borda">
        <Icone className="size-6 text-marca-texto" aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-slate-900">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{descricao}</p>
      {acoes && <div className="mt-5 flex flex-wrap justify-center gap-2">{acoes}</div>}
    </div>
  );
}

const ESTILO_STATUS = {
  ativa: { rotulo: "Ativa", classe: "bg-emerald-50 text-emerald-700 ring-emerald-200", ponto: "bg-emerald-500" },
  disponivel: { rotulo: "Em estoque", classe: "bg-slate-100 text-slate-700 ring-slate-200", ponto: "bg-slate-400" },
  reservada: { rotulo: "Reservada", classe: "bg-violet-50 text-violet-700 ring-violet-200", ponto: "bg-violet-500" },
  atribuida: { rotulo: "Aguardando ativação", classe: "bg-amber-50 text-amber-700 ring-amber-200", ponto: "bg-amber-500" },
  desativada: { rotulo: "Desativada", classe: "bg-red-50 text-red-700 ring-red-200", ponto: "bg-red-500" },
} as const;

export function PilulaStatus({ status }: { status: keyof typeof ESTILO_STATUS }) {
  const { rotulo, classe, ponto } = ESTILO_STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1", classe)}>
      <span className={cn("size-1.5 rounded-full", ponto)} aria-hidden />
      {rotulo}
    </span>
  );
}

type Ponto = { dia: string; nfc: number; qr: number };

const formatoDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

/** Barras empilhadas NFC + QR por dia, em SVG puro. */
export function GraficoLeituras({ serie }: { serie: Ponto[] }) {
  const largura = 720;
  const altura = 220;
  const margem = { topo: 12, base: 26, esquerda: 32, direita: 4 };
  const area = { l: largura - margem.esquerda - margem.direita, a: altura - margem.topo - margem.base };
  const maximo = Math.max(4, ...serie.map((p) => p.nfc + p.qr));
  const passo = Math.ceil(maximo / 4);
  const topo = passo * 4;
  const coluna = area.l / Math.max(serie.length, 1);
  const barra = Math.max(3, Math.min(18, coluna * 0.62));
  const y = (v: number) => margem.topo + area.a - (v / topo) * area.a;
  const marcas = [0, 1, 2, 3, 4].map((i) => i * passo);
  const rotulos = serie.filter((_, i) => i % Math.ceil(serie.length / 6) === 0 || i === serie.length - 1);

  return (
    <figure className="min-w-0">
      {/* No celular o gráfico mantém largura mínima legível e rola só dentro do próprio bloco. */}
      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
      <svg viewBox={`0 0 ${largura} ${altura}`} className="h-auto w-full min-w-[520px] sm:min-w-0" role="img" aria-label="Leituras por dia, NFC e QR Code">
        <defs>
          <linearGradient id="grad-nfc" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2dd4ff" />
            <stop offset="100%" stopColor="#1767ff" />
          </linearGradient>
        </defs>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margem.esquerda} x2={largura - margem.direita} y1={y(m)} y2={y(m)} stroke="#e2e8f0" strokeDasharray={m === 0 ? undefined : "3 4"} />
            <text x={margem.esquerda - 8} y={y(m)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px] max-sm:text-[15px]">
              {m}
            </text>
          </g>
        ))}
        {serie.map((p, i) => {
          const x = margem.esquerda + coluna * i + (coluna - barra) / 2;
          const hQr = (p.qr / topo) * area.a;
          const hNfc = (p.nfc / topo) * area.a;
          const base = margem.topo + area.a;
          return (
            <g key={p.dia}>
              <title>{`${formatoDia.format(new Date(p.dia))}: ${p.nfc} NFC, ${p.qr} QR`}</title>
              {hQr > 0 && <rect x={x} y={base - hQr} width={barra} height={hQr} rx={Math.min(3, barra / 2)} fill="#c7d9ff" />}
              {hNfc > 0 && <rect x={x} y={base - hQr - hNfc} width={barra} height={hNfc} rx={Math.min(3, barra / 2)} fill="url(#grad-nfc)" />}
            </g>
          );
        })}
        {rotulos.map((p) => {
          const i = serie.indexOf(p);
          return (
            <text key={p.dia} x={margem.esquerda + coluna * i + coluna / 2} y={altura - 6} textAnchor="middle" className="fill-slate-400 text-[11px] max-sm:text-[15px]">
              {formatoDia.format(new Date(p.dia))}
            </text>
          );
        })}
      </svg>
      </div>
      <figcaption className="mt-3 flex items-center gap-5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-gradient-to-b from-marca-ciano to-marca" /> NFC
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#c7d9ff]" /> QR Code
        </span>
      </figcaption>
    </figure>
  );
}
