"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cadastrarAdmin, type EstadoAdmin } from "./acoes";

export function FormNovoAdmin() {
  const [estado, acao, salvando] = useActionState<EstadoAdmin, FormData>(cadastrarAdmin, { tipo: "inicial" });
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.tipo === "sucesso") formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" required maxLength={120} autoComplete="off" className="h-11 text-base" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required autoComplete="off" className="h-11 text-base" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Senha inicial</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={10}
          maxLength={72}
          autoComplete="new-password"
          className="h-11 text-base"
        />
        <p className="text-sm text-muted-foreground">
          Mínimo de 10 caracteres. Só vale para contas novas; quem já tem conta mantém a senha que tem.
        </p>
      </div>

      {estado.tipo !== "inicial" && (
        <Alert variant={estado.tipo === "erro" ? "destructive" : "default"} role={estado.tipo === "erro" ? "alert" : "status"}>
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 self-start px-5 text-base" disabled={salvando}>
        {salvando ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
        {salvando ? "Cadastrando..." : "Cadastrar administrador"}
      </Button>
    </form>
  );
}
