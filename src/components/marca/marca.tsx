import Image from "next/image";
import { cn } from "cn";

/**
 * Identidade Speed Tag (versão azul). Logo e símbolo são PNG transparentes recortados por scripts/recortar-logo.py
 * da arte original (fundo azul-marinho removido), para fundo escuro; em fundo claro o S
 * vai num selo azul-marinho. Arquivos: public/marca/speedtag.png (1098x299) e
 * speedtag-simbolo.png (512x512, sem a barra diagonal).
 */
export function LogoCompleta({ className, prioridade = false }: { className?: string; prioridade?: boolean }) {
  return (
    <Image
      src="/marca/speedtag.png"
      alt="Speed Tag"
      width={1098}
      height={299}
      priority={prioridade}
      className={cn("h-9 w-auto select-none", className)}
    />
  );
}

export function SimboloS({ tamanho = 36, className }: { tamanho?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 overflow-hidden rounded-xl bg-marca-fundo ring-1 ring-black/10", className)}
      style={{ width: tamanho, height: tamanho }}
    >
      <Image src="/marca/speedtag-simbolo.png" alt="" width={512} height={512} className="size-full select-none" />
    </span>
  );
}

/** S + nome em texto, para fundos claros (topo no celular, menu do admin). */
export function MarcaCompacta({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="Speed Tag">
      <SimboloS tamanho={34} />
      <span className="text-[17px] font-extrabold tracking-tight text-slate-950 italic" aria-hidden>
        SPEED<span className="text-marca-texto">TAG</span>
      </span>
    </span>
  );
}
