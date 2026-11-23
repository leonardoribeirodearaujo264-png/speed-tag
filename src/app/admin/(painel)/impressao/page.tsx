import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArtePlaca } from "@/components/placa/arte-placa";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { buscarPlacaPorCodigo, listarCodigosDoLote } from "@/lib/placas/consultas";
import { MODELOS_ARTE, NOMES_MODELOS, modeloArte } from "@/lib/placas/modelos-arte";
import { qrDaArte } from "@/lib/placas/qr";
import { urlQr } from "@/lib/placas/urls";
import { BotaoImprimir } from "./botao-imprimir";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Folha de impressão" };

/** Placas por tela de impressão; lotes maiores são impressos em partes. */
const POR_PAGINA = 120;
/** 1 cm em px CSS (96 px por polegada). */
const PX_POR_CM = 96 / 2.54;
const LADOS_CM = [6, 8, 10] as const;

const esquema = z.object({
  lote: z.uuid().optional().catch(undefined),
  codigo: z.string().max(12).optional().catch(undefined),
  cm: z.coerce.number().pipe(z.union(LADOS_CM.map((v) => z.literal(v)))).default(8).catch(8),
  pagina: z.coerce.number().int().min(1).default(1).catch(1),
  modelo: z.unknown().transform(modeloArte),
});

export default async function Impressao({ searchParams }: PageProps<"/admin/impressao">) {
  const { supabase } = await exigirAdmin("/admin/impressao");
  const f = esquema.parse(await searchParams);

  let codigos: string[];
  let titulo: string;
  if (f.codigo) {
    const busca = await buscarPlacaPorCodigo(supabase, f.codigo);
    if (!busca.ok) notFound();
    codigos = [busca.dado.codigo];
    titulo = `Placa ${busca.dado.codigo}`;
  } else if (f.lote) {
    const { data: lote } = await supabase.from("lotes").select("nome").eq("id", f.lote).maybeSingle();
    const todos = lote ? await listarCodigosDoLote(supabase, f.lote) : null;
    if (!lote || !todos) notFound();
    codigos = todos;
    titulo = lote.nome;
  } else {
    notFound();
  }

  const paginas = Math.max(1, Math.ceil(codigos.length / POR_PAGINA));
  const pagina = Math.min(f.pagina, paginas);
  const visiveis = codigos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const artes = await Promise.all(
    visiveis.map(async (codigo) => ({ codigo, qr: await qrDaArte(urlQr(codigo)) })),
  );
  const ladoPx = Math.round(f.cm * PX_POR_CM);

  const link = (mudancas: Partial<typeof f>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, pagina, ...mudancas })) if (v !== undefined) p.set(k, String(v));
    return `/admin/impressao?${p}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <style>{`@page { size: A4; margin: 10mm; }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Folha de impressão</h1>
          <p className="text-sm text-muted-foreground">
            {titulo} · {codigos.length.toLocaleString("pt-BR")} {codigos.length === 1 ? "placa" : "placas"}
            {paginas > 1 && ` · parte ${pagina} de ${paginas}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Arte:</span>
          {NOMES_MODELOS.map((modelo) => (
            <Link
              key={modelo}
              href={link({ modelo })}
              aria-current={modelo === f.modelo ? "true" : undefined}
              className={buttonVariants({ variant: modelo === f.modelo ? "secondary" : "ghost", size: "sm" })}
            >
              {MODELOS_ARTE[modelo].rotulo}
            </Link>
          ))}
          <span className="ml-2 text-sm text-muted-foreground">Lado:</span>
          {LADOS_CM.map((cm) => (
            <Link
              key={cm}
              href={link({ cm })}
              aria-current={cm === f.cm ? "true" : undefined}
              className={buttonVariants({ variant: cm === f.cm ? "secondary" : "ghost", size: "sm" })}
            >
              {cm} cm
            </Link>
          ))}
          <BotaoImprimir />
        </div>
      </div>

      <p className="text-sm text-muted-foreground print:hidden">
        No diálogo de impressão use escala 100% (tamanho real) e desative cabeçalhos e rodapés. Para PDF, escolha
        &quot;Salvar como PDF&quot;. As linhas tracejadas são guia de corte.
      </p>

      <div className="flex flex-wrap gap-[4mm] bg-white p-4 print:p-0">
        {artes.map(({ codigo, qr }) => (
          <div key={codigo} className="break-inside-avoid border border-dashed border-slate-300 p-[2mm]">
            <ArtePlaca codigo={codigo} qrDataUri={qr} tamanho={ladoPx} modelo={f.modelo} />
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
