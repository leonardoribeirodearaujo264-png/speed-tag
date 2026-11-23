"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { definirSenhaCliente } from "./acoes";

export function FormDefinirSenha({ destino }: { destino?: string }) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(async (anterior: { mensagem: string; ok: boolean }, dados: FormData) => {
    const resultado = await definirSenhaCliente(anterior, dados);
    if (resultado.ok && destino) router.replace(destino);
    return resultado;
  }, { mensagem: "", ok: false });
  return (
    <form action={acao} className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        <span>Nova senha</span>
        <Input name="senha" type="password" autoComplete="new-password" minLength={10} maxLength={72} className="min-h-11" required />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>Confirmar nova senha</span>
        <Input name="confirmacao" type="password" autoComplete="new-password" minLength={10} maxLength={72} className="min-h-11" required />
      </label>
      <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pendente}>
        {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
        {pendente ? "Salvando..." : "Salvar senha"}
      </Button>
      {estado.mensagem && <p role={estado.ok ? "status" : "alert"} className={estado.ok ? "text-sm text-emerald-800" : "text-sm text-destructive"}>{estado.mensagem}</p>}
    </form>
  );
}
