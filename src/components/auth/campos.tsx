"use client";

import { useEffect, useRef, useState, type ComponentProps, type ComponentType } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

type IconeProps = { className?: string; "aria-hidden"?: boolean };

type CampoProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  rotulo: string;
  icone: ComponentType<IconeProps>;
  ajuda?: string;
  acaoRotulo?: React.ReactNode;
};

const classeEntrada =
  "h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3 pl-10 text-base text-slate-900 transition-colors outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-marca-forte focus:bg-white focus:ring-4 focus:ring-marca/25 aria-invalid:border-red-400 aria-invalid:ring-red-500/10";

export function CampoTexto({ id, rotulo, icone: Icone, ajuda, acaoRotulo, className, ...props }: CampoProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium text-slate-700">
          {rotulo}
        </Label>
        {acaoRotulo}
      </div>
      <div className="relative">
        <Icone className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input id={id} name={id} className={cn(classeEntrada, className)} aria-describedby={ajuda ? `${id}-ajuda` : undefined} {...props} />
      </div>
      {ajuda && (
        <p id={`${id}-ajuda`} className="text-xs text-slate-500">
          {ajuda}
        </p>
      )}
    </div>
  );
}

/** Força simples e explicável: tamanho e variedade de caracteres. */
export function forcaSenha(senha: string): 0 | 1 | 2 | 3 {
  if (senha.length < 10) return 0;
  const variedade = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(senha)).length;
  if (senha.length >= 14 && variedade >= 3) return 3;
  if (variedade >= 2) return 2;
  return 1;
}

const ROTULO_FORCA = ["Muito curta", "Fraca", "Boa", "Forte"] as const;
const COR_FORCA = ["bg-red-400", "bg-amber-400", "bg-marca-claro0", "bg-emerald-500"] as const;

type CampoSenhaProps = Omit<CampoProps, "icone" | "type"> & { icone: CampoProps["icone"]; medidor?: boolean };

export function CampoSenha({ medidor = false, onChange, ...props }: CampoSenhaProps) {
  const [visivel, setVisivel] = useState(false);
  const [valor, setValor] = useState("");
  const forca = forcaSenha(valor);
  const caixa = useRef<HTMLDivElement>(null);

  // Ações de formulário do React 19 limpam os campos ao terminar; o medidor acompanha.
  useEffect(() => {
    const formulario = caixa.current?.closest("form");
    const limpar = () => setValor("");
    formulario?.addEventListener("reset", limpar);
    return () => formulario?.removeEventListener("reset", limpar);
  }, []);

  return (
    <div ref={caixa} className="flex flex-col gap-2">
      <div className="relative">
        <CampoTexto
          {...props}
          type={visivel ? "text" : "password"}
          className="pr-12"
          onChange={(e) => {
            setValor(e.target.value);
            onChange?.(e);
          }}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="absolute right-1.5 bottom-1.5 flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {medidor && valor.length > 0 && (
        <div className="flex items-center gap-3" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn("h-1 flex-1 rounded-full transition-colors", i < Math.max(forca, 1) ? COR_FORCA[forca] : "bg-slate-200")}
              />
            ))}
          </div>
          <span className="w-20 text-right text-xs text-slate-500">{ROTULO_FORCA[forca]}</span>
        </div>
      )}
    </div>
  );
}

export function BotaoPrincipal({ carregando, children, className, ...props }: ComponentProps<"button"> & { carregando?: boolean }) {
  return (
    <button
      type="submit"
      disabled={carregando || props.disabled}
      className={cn(
        "relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-marca to-[#1a8cff] text-[15px] font-semibold text-white shadow-lg shadow-marca/30 transition-all outline-none hover:bg-marca-forte focus-visible:ring-4 focus-visible:ring-marca/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {carregando && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
      {children}
    </button>
  );
}

export function MensagemErro({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-in fade-in">
      {children}
    </div>
  );
}
