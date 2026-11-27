import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { z } from "zod";
import { ArtePlaca } from "@/components/placa/arte-placa";
import { EtiquetaQr, POSICOES_CODIGO, posicaoCodigo } from "@/components/placa/etiqueta-qr";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { buscarPlacaPorCodigo, listarCodigosDoLote, modeloDoLote, modelosDasPlacas } from "@/lib/placas/consultas";
import { MODELOS_ARTE, NOMES_MODELOS, modeloArte } from "@/lib/placas/modelos-arte";
import { qrDaArte, qrDaEtiqueta } from "@/lib/placas/qr";
import { urlQr } from "@/lib/placas/urls";
import { BotaoImprimir } from "./botao-imprimir";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Folha de impressão" };

const NOMES_POSICAO: Record<(typeof POSICOES_CODIGO)[number], string> = { embaixo: "Embaixo", meio: "No meio" };

/** Placas por tela de impressão; lotes maiores são impressos em partes. */
const POR_PAGINA = 120;
/** 1 cm em px CSS (96 px por polegada). */
const PX_POR_CM = 96 / 2.54;
/** Lados por tipo: a placa com arte e a etiqueta só de QR (menor). */
const LADOS_ARTE: readonly number[] = [6, 8, 10];
const LADOS_QR: readonly number[] = [3, 4, 5, 6];
const LADOS_CM = [...new Set([...LADOS_QR, ...LADOS_ARTE])];

const esquema = z.object({
  lote: z.uuid().optional().catch(undefined),
  codigo: z.string().max(12).optional().catch(undefined),
  cm: z.coerce.number().int().refine((v) => LADOS_CM.includes(v)).optional().catch(undefined),
  tipo: z.enum(["arte", "qr"]).default("arte").catch("arte"),
  pos: z.enum(POSICOES_CODIGO).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).default(1).catch(1),
  modelo: z.string().optional().catch(undefined),
});

export default async function Impressao({ searchParams }: PageProps<"/admin/impressao">) {
  const { supabase } = await exigirAdmin("/admin/impressao");
  const f = esquema.parse(await searchParams);
  const soQr = f.tipo === "qr";
  const lados = soQr ? LADOS_QR : LADOS_ARTE;
  const cm = f.cm !== undefined && lados.includes(f.cm) ? f.cm : soQr ? 4 : 8;
  const posicao = posicaoCodigo(f.pos);

  let codigos: string[];
  let titulo: string;
  let loteDaArte: string | null;
  if (f.codigo) {
    const busca = await buscarPlacaPorCodigo(supabase, f.codigo);
    if (!busca.ok) notFound();
    codigos = [busca.dado.codigo];
    titulo = `Placa ${busca.dado.codigo}`;
    loteDaArte = busca.dado.lote_id;
  } else if (f.lote) {
    const { data: lote } = await supabase.from("lotes").select("nome").eq("id", f.lote).maybeSingle();
    const todos = lote ? await listarCodigosDoLote(supabase, f.lote) : null;
    if (!lote || !todos) notFound();
    codigos = todos;
    titulo = lote.nome;
    loteDaArte = f.lote;
  } else {
    notFound();
  }

  // Cada placa sai com a sua cor (a da placa ou a do lote). ?modelo= filtra só uma cor.
  const cores = await modelosDasPlacas(supabase, codigos, await modeloDoLote(supabase, loteDaArte));
  const contagemCores = Object.fromEntries(NOMES_MODELOS.map((m) => [m, codigos.filter((c) => cores.get(c) === m).length])) as Record<keyof typeof MODELOS_ARTE, number>;
  const filtroCor = f.modelo && (NOMES_MODELOS as readonly string[]).includes(f.modelo) ? modeloArte(f.modelo) : null;
  if (filtroCor && !soQr) codigos = codigos.filter((c) => cores.get(c) === filtroCor);
  const misto = NOMES_MODELOS.filter((m) => contagemCores[m] > 0).length > 1;

  const paginas = Math.max(1, Math.ceil(codigos.length / POR_PAGINA));
  const pagina = Math.min(f.pagina, paginas);
  const visiveis = codigos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const artes = await Promise.all(
    visiveis.map(async (codigo) => ({
      codigo,
      modelo: cores.get(codigo) ?? modeloArte(null),
      qr: soQr ? await qrDaEtiqueta(urlQr(codigo), posicao === "meio") : await qrDaArte(urlQr(codigo)),
    })),
  );
  const ladoPx = Math.round(cm * PX_POR_CM);
  // Sempre com "?": o PDF e o ZIP acrescentam &lado=.
  const urlImagem = (codigo: string) =>
    soQr ? `/api/admin/placas/${codigo}/etiqueta-qr?posicao=${posicao}` : `/api/admin/placas/${codigo}/arte?`;

  const link = (mudancas: Partial<typeof f>) => {
    const p = new URLSearchParams();
    const atual = { ...f, cm, pos: soQr ? posicao : undefined, pagina, ...mudancas };
    for (const [k, v] of Object.entries(atual)) if (v !== undefined && !(k === "tipo" && v === "arte")) p.set(k, String(v));
    return `/admin/impressao?${p}`;
  };

  return (
    <div className="flex flex-col gap-5 print:block">
      {/* Impressão: o Safari não divide flexbox em páginas e cortava a folha; aqui tudo vira bloco. */}
      <style>{`@page { size: A4; margin: 10mm; } @media print { html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{soQr ? "Folha de QR Codes" : "Folha de impressão"}</h1>
          <p className="text-sm text-muted-foreground">
            {titulo} · {codigos.length.toLocaleString("pt-BR")} {codigos.length === 1 ? "placa" : "placas"}
            {paginas > 1 && ` · parte ${pagina} de ${paginas}`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto">
          <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Imprimir:</span>
          {(["arte", "qr"] as const).map((tipo) => (
            <Link key={tipo} href={link({ tipo, cm: undefined, pos: undefined, modelo: undefined, pagina: 1 })} aria-current={tipo === f.tipo ? "true" : undefined}
              className={buttonVariants({ variant: tipo === f.tipo ? "secondary" : "ghost", size: "sm" })}>
              {tipo === "arte" ? "Placa com arte" : "Só QR e código"}
            </Link>
          ))}
          </div>
          {soQr ? (
          <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Código:</span>
          {POSICOES_CODIGO.map((pos) => (
            <Link key={pos} href={link({ pos })} aria-current={pos === posicao ? "true" : undefined}
              className={buttonVariants({ variant: pos === posicao ? "secondary" : "ghost", size: "sm" })}>
              {NOMES_POSICAO[pos]}
            </Link>
          ))}
          </div>
          ) : (
          <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Cor:</span>
          {misto && (
            <Link href={link({ modelo: undefined, pagina: 1 })} aria-current={!filtroCor ? "true" : undefined}
              className={buttonVariants({ variant: !filtroCor ? "secondary" : "ghost", size: "sm" })}>
              Todas
            </Link>
          )}
          {NOMES_MODELOS.filter((modelo) => contagemCores[modelo] > 0).map((modelo) => (
            <Link
              key={modelo}
              href={link({ modelo, pagina: 1 })}
              aria-current={modelo === filtroCor || (!misto && !filtroCor) ? "true" : undefined}
              className={buttonVariants({ variant: modelo === filtroCor || (!misto && !filtroCor) ? "secondary" : "ghost", size: "sm" })}
            >
              {MODELOS_ARTE[modelo].rotulo} ({contagemCores[modelo]})
            </Link>
          ))}
          </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Lado:</span>
          {lados.map((opcao) => (
            <Link
              key={opcao}
              href={link({ cm: opcao })}
              aria-current={opcao === cm ? "true" : undefined}
              className={buttonVariants({ variant: opcao === cm ? "secondary" : "ghost", size: "sm" })}
            >
              {opcao} cm
            </Link>
          ))}
          </div>
          {visiveis.length > 0 && (
            <BotaoImprimir
              key={link({})}
              itens={visiveis.map((codigo) => ({ codigo, url: urlImagem(codigo) }))}
              lado={cm}
              nome={`speedtag-${f.lote ?? visiveis[0]}${soQr ? `-qr-${posicao}` : filtroCor ? `-${filtroCor}` : ""}-${pagina}`}
            />
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground print:hidden">
        No diálogo de impressão use escala 100% (tamanho real) e desative cabeçalhos e rodapés. Para PDF, escolha
        &quot;Salvar como PDF&quot;. As linhas tracejadas são guia de corte. Para a gráfica, &quot;PNGs para a gráfica&quot;
        baixa um arquivo por placa, com o código no nome, a 300 dpi no tamanho real e sem a folha branca em volta.
      </p>

      <div className="flex min-w-0 flex-wrap gap-[4mm] rounded-xl bg-white p-3 sm:p-4 print:block print:rounded-none print:p-0">
        {artes.map(({ codigo, modelo, qr }) => (
          <div key={codigo} className="min-w-0 max-w-full shrink-0 break-inside-avoid border border-dashed border-slate-300 p-[2mm] print:mr-[4mm] print:mb-[4mm] print:inline-block print:max-w-none print:align-top" style={{ width: `calc(${cm}cm + 4mm + 2px)` }}>
            {soQr
              ? <EtiquetaQr codigo={codigo} qrDataUri={qr} tamanho={ladoPx} posicao={posicao} responsiva />
              : <ArtePlaca codigo={codigo} qrDataUri={qr} tamanho={ladoPx} modelo={modelo} responsiva />}
            <a href={`${urlImagem(codigo)}&baixar=1`} aria-label={`Baixar PNG da placa ${codigo}`}
              className={buttonVariants({ variant: "outline", className: "mt-2 min-h-11 w-full print:hidden" })}>
              <Download aria-hidden /> Baixar PNG
            </a>
          </div>
        ))}
      </div>

      {paginas > 1 && (
        <nav aria-label="Partes do lote" className="flex items-center justify-center gap-3 text-sm print:hidden">
          {pagina > 1 && <Link href={link({ pagina: pagina - 1 })} className={buttonVariants({ variant: "outline", size: "sm" })}>Parte anterior</Link>}
          <span className="text-muted-foreground">Parte {pagina} de {paginas}</span>
          {pagina < paginas && <Link href={link({ pagina: pagina + 1 })} className={buttonVariants({ variant: "outline", size: "sm" })}>Próxima parte</Link>}
        </nav>
      )}
    </div>
  );
}
