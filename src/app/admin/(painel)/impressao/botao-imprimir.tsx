"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotaoImprimir() {
  return (
    <Button onClick={() => window.print()}>
      <Printer aria-hidden /> Imprimir ou salvar PDF
    </Button>
  );
}
