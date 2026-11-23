"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock, Mail, MailCheck, User } from "lucide-react";
import { BotaoPrincipal, CampoSenha, CampoTexto, MensagemErro } from "@/components/auth/campos";
import { registrarAdmin, type EstadoRegistro } from "./acoes";

export function FormRegistrar() {
  const [estado, acao, enviando] = useActionState<EstadoRegistro, FormData>(registrarAdmin, { tipo: "inicial" });

  if (estado.tipo === "confirmar_email") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-8 text-center animate-in fade-in zoom-in-95" role="status">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-marca-claro ring-1 ring-marca-borda">
          <MailCheck className="size-7 text-marca-texto" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold text-slate-900">Confirme seu e-mail</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Enviamos um link para <span className="font-medium text-slate-700">{estado.email}</span>. Abra o link para
            ativar a conta. Depois, um administrador aprova o seu acesso.
          </p>
        </div>
        <Link href="/admin/entrar" className="text-sm font-medium text-marca-texto hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  const campos = estado.tipo === "erro" ? estado.campos : { nome: "", email: "" };

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      <CampoTexto id="nome" rotulo="Nome completo" icone={User} autoComplete="name" placeholder="Seu nome" required defaultValue={campos.nome} />
      <CampoTexto
        id="email"
        rotulo="E-mail"
        icone={Mail}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="voce@empresa.com"
        required
        defaultValue={campos.email}
      />
      <CampoSenha id="senha" rotulo="Senha" icone={Lock} autoComplete="new-password" placeholder="Mínimo de 10 caracteres" required medidor />
      <CampoSenha id="confirmacao" rotulo="Confirmar senha" icone={Lock} autoComplete="new-password" placeholder="Repita a senha" required />

      {estado.tipo === "erro" && <MensagemErro>{estado.mensagem}</MensagemErro>}

      <BotaoPrincipal carregando={enviando}>{enviando ? "Criando conta..." : "Criar conta"}</BotaoPrincipal>
      <p className="text-center text-xs leading-relaxed text-slate-400">
        O acesso ao painel é liberado depois da aprovação de um administrador.
      </p>
    </form>
  );
}
