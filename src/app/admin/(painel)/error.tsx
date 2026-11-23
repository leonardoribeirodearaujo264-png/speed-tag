"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErroAdmin({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-white p-8 text-center">
      <TriangleAlert className="size-8 text-destructive" aria-hidden />
      <h1 className="text-lg font-semibold">Não foi possível carregar esta tela</h1>
      <p className="text-sm text-muted-foreground">
        Pode ser uma falha momentânea de conexão com o banco. Tente de novo; se continuar, informe o código abaixo ao suporte.
      </p>
      {error.digest && <code className="rounded bg-slate-100 px-2 py-1 text-xs">{error.digest}</code>}
      <Button onClick={() => retry()}>Tentar de novo</Button>
    </div>
  );
}
