"use client";

import { useActionState, useState } from "react";
import { Check, Lock } from "lucide-react";
import { BotaoPrincipal, CampoSenha, MensagemErro } from "@/components/auth/campos";
import { REQUISITOS_SENHA } from "@/lib/auth-email/regras-senha";
import { salvarNovaSenha, type EstadoNovaSenha } from "@/lib/auth-email/senha";

/** Criar senha (conta nova) ou redefinir (recuperação). Leva ao destino ao salvar. */
export function FormNovaSenha({ destino, rotulo = "Salvar senha e entrar" }: { destino: string; rotulo?: string }) {
  const [estado, acao, salvando] = useActionState<EstadoNovaSenha, FormData>(salvarNovaSenha.bind(null, destino), { erro: "" });
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const divergente = confirmacao.length > 0 && senha !== confirmacao;

  return (
    <form action={acao} className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <CampoSenha id="senha" rotulo="Nova senha" icone={Lock} autoComplete="new-password" required maxLength={72} medidor onChange={(e) => setSenha(e.target.value)} />
        <ul className="grid gap-1.5 text-sm" aria-label="Requisitos da senha">
          {REQUISITOS_SENHA.map((r) => {
            const ok = r.ok(senha);
            return (
              <li key={r.id} className={`flex items-center gap-2 transition-colors ${ok ? "text-emerald-700" : "text-slate-500"}`}>
                <span className={`flex size-4 items-center justify-center rounded-full transition-colors ${ok ? "bg-emerald-500 text-white" : "border border-slate-300"}`}>
                  {ok && <Check className="size-3" aria-hidden />}
                </span>
                {r.rotulo}
                <span className="sr-only">{ok ? "(atendido)" : "(pendente)"}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <CampoSenha id="confirmacao" rotulo="Confirmar senha" icone={Lock} autoComplete="new-password" required maxLength={72} aria-invalid={divergente} onChange={(e) => setConfirmacao(e.target.value)} />
        {divergente && <p className="text-sm text-red-600">As senhas não coincidem.</p>}
      </div>
      {estado.erro && <MensagemErro>{estado.erro}</MensagemErro>}
      <BotaoPrincipal carregando={salvando}>{salvando ? "Salvando..." : rotulo}</BotaoPrincipal>
    </form>
  );
}
