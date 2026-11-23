import type { ReactNode } from "react";
import { BarChart3, Nfc, Zap } from "lucide-react";
import { LogoCompleta } from "@/components/marca/marca";
import { ArtePlaca } from "@/components/placa/arte-placa";
import { qrDaArte } from "@/lib/placas/qr";

/** QR ilustrativo do painel da marca: URL fixa, não depende de ambiente. */
const URL_DEMONSTRACAO = "https://exemplo.com/t/A1B2C3?o=q";

const DESTAQUES = [
  { icone: Nfc, texto: "NFC e QR Code na mesma placa" },
  { icone: Zap, texto: "Ativação pelo cliente em menos de 1 minuto" },
  { icone: BarChart3, texto: "Cada leitura vira estatística no painel" },
] as const;

async function PainelMarca() {
  const qr = await qrDaArte(URL_DEMONSTRACAO);

  return (
    <aside className="relative hidden overflow-hidden bg-marca-fundo lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Fundo: brilho azul e ciano da marca e linhas de velocidade, como no símbolo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(23,103,255,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(45,212,255,0.18),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />
      <div aria-hidden className="pointer-events-none absolute top-[38%] -left-10 flex -skew-x-12 flex-col gap-3 opacity-40">
        <span className="h-[3px] w-64 rounded-full bg-gradient-to-r from-transparent to-marca-ciano" />
        <span className="ml-10 h-[3px] w-48 rounded-full bg-gradient-to-r from-transparent to-marca-ciano" />
        <span className="ml-4 h-[3px] w-36 rounded-full bg-gradient-to-r from-transparent to-marca-ciano" />
      </div>

      <div className="relative">
        <LogoCompleta className="h-14" prioridade />
      </div>

      <div className="relative flex flex-col gap-10">
        <div className="max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance text-white">
            Mais avaliações no Google, <span className="bg-gradient-to-r from-marca-ciano to-[#5b8cff] bg-clip-text text-transparent">com um toque.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-300">
            Crie as placas, grave o NFC e acompanhe cada leitura. Seus clientes ativam sozinhos.
          </p>
        </div>

        <div className="flex items-end gap-8">
          <div className="shrink-0 -rotate-6 overflow-hidden rounded-[22px] shadow-2xl shadow-black/60 ring-1 ring-white/10 transition-transform duration-500 hover:rotate-0">
            <ArtePlaca codigo="A1B2C3" qrDataUri={qr} tamanho={220} />
          </div>
          <ul className="flex flex-col gap-4 pb-2">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-sm text-neutral-200">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                  <Icone className="size-4 text-marca-ciano" aria-hidden />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="relative text-xs text-neutral-500">Placas NFC e QR Code para avaliações no Google</p>
    </aside>
  );
}

type Props = {
  titulo: string;
  subtitulo: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  /** Selo acima do título, ex.: "Área administrativa". */
  selo?: string;
};

/**
 * Casca das telas de login, cadastro e senha. Celular: faixa escura com a logo oficial e o
 * formulário num cartão branco que sobe da base (respeita as áreas seguras do iPhone).
 * Computador: painel da marca à esquerda e formulário centralizado à direita.
 */
export function LayoutAutenticacao({ titulo, subtitulo, children, rodape, selo }: Props) {
  return (
    <div className="grid min-h-dvh flex-1 bg-marca-fundo lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:bg-white">
      <PainelMarca />

      <main className="relative flex min-h-dvh flex-col lg:min-h-0">
        <div className="pt-seguro relative overflow-hidden lg:hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(23,103,255,0.45),transparent_70%)]" />
          <div className="relative flex justify-center px-6 pt-8 pb-10">
            <LogoCompleta className="h-10 drop-shadow-[0_8px_24px_rgba(23,103,255,0.35)]" prioridade />
          </div>
        </div>

        <div className="pb-seguro relative -mt-4 flex flex-1 flex-col rounded-t-[28px] bg-white px-5 pt-8 sm:px-10 lg:mt-0 lg:rounded-none lg:pt-8">
          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col py-2 animate-in fade-in slide-in-from-bottom-2 duration-500 lg:justify-center lg:py-10">
            {selo && (
              <span className="mb-4 inline-flex w-fit items-center rounded-full bg-marca-claro px-3 py-1 text-xs font-medium text-marca-texto ring-1 ring-marca-borda">
                {selo}
              </span>
            )}
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-slate-900 sm:text-3xl">{titulo}</h1>
            <div className="mt-2 text-[15px] leading-relaxed text-slate-500">{subtitulo}</div>
            <div className="mt-7">{children}</div>
            {rodape && <div className="mt-8 text-center text-sm text-slate-500">{rodape}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
