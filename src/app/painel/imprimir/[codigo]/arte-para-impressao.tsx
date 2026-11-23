"use client";

import { useState } from "react";
import Image from "next/image";
import { Download, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function ArteParaImpressao({ codigo }: { codigo: string }) {
  const [estado, setEstado] = useState<"carregando" | "pronta" | "erro">("carregando");
  const url = `/painel/arte/${codigo}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:flex sm:flex-wrap print:hidden">
        <Button type="button" className="min-h-11" onClick={() => window.print()} disabled={estado !== "pronta"}>
          <Printer aria-hidden /> Imprimir ou salvar PDF
        </Button>
        <a className={buttonVariants({ variant: "outline", className: "min-h-11" })} href={`${url}?baixar=1`}>
          <Download aria-hidden /> Baixar arte
        </a>
      </div>
      {estado === "erro" && <p role="alert" className="text-sm text-red-700 print:hidden">Não foi possível carregar a arte. Atualize a página e tente novamente.</p>}
      <Image unoptimized src={url} alt={`Arte da placa ${codigo}`} width={2000} height={2000}
        onLoad={() => setEstado("pronta")} onError={() => setEstado("erro")}
        className="mx-auto h-auto w-full max-w-md rounded-xl border sm:mx-0 print:max-w-[140mm] print:rounded-none print:border-none" />
    </div>
  );
}
