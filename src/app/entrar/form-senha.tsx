"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Lock, Mail, MailCheck, Phone, User } from "lucide-react";
import { BotaoPrincipal, CampoSenha, CampoTexto, MensagemErro } from "@/components/auth/campos";
import { REQUISITOS_SENHA } from "@/lib/auth-email/regras-senha";
import { cadastrarCliente, entrarComSenha, type EstadoCadastro } from "./acoes";

/** Login com e-mail e senha. */
export function FormSenha({ destino, erroInicial }: { destino: string; erroInicial?: string }) {
  const [erro, acao, pendente] = useActionState(entrarComSenha.bind(null, destino), erroInicial ?? "");
  return (
    <form action={acao} className="flex flex-col gap-5">
      <CampoTexto id="email" rotulo="E-mail" icone={Mail} type="email" inputMode="email" autoComplete="username"
        autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="voce@empresa.com.br" aria-invalid={!!erro} />
      <CampoSenha id="senha" rotulo="Senha" icone={Lock} autoComplete="current-password" required maxLength={200} aria-invalid={!!erro}
        acaoRotulo={
          <Link href={`/recuperar-senha?proximo=${encodeURIComponent(destino)}`} className="-my-3 inline-flex min-h-11 items-center rounded text-sm font-medium text-marca-texto hover:underline focus-visible:ring-2 focus-visible:ring-marca/40 focus-visible:outline-none">
            Esqueci minha senha
          </Link>
        } />
      <label className="-my-1 flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-slate-600 select-none">
        <input type="checkbox" name="lembrar" defaultChecked className="size-5 rounded-md border-slate-300 accent-marca" />
        Lembrar de mim
      </label>
      {erro && <MensagemErro>{erro}</MensagemErro>}
      <BotaoPrincipal carregando={pendente}>{pendente ? "Entrando..." : "Entrar"}</BotaoPrincipal>
    </form>
  );
}

/** Cadastro convencional (página /cadastro). */
export function FormCadastro({ destino }: { destino: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(cadastrarCliente.bind(null, destino), {});
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const divergente = confirmacao.length > 0 && senha !== confirmacao;

  if (estado.pendente) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center animate-in fade-in">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold text-slate-900">Confirme seu e-mail</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Enviamos um link para <strong className="break-all">{estado.email}</strong>. Toque no botão do e-mail para ativar
            sua conta. Se não chegar, confira o spam.
          </p>
        </div>
        <Link href={`/entrar?proximo=${encodeURIComponent(destino)}`} className="text-sm font-medium text-marca-texto hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-5">
      <CampoTexto id="nome" rotulo="Nome completo" icone={User} autoComplete="name" required minLength={3} maxLength={120} placeholder="Maria da Silva" />
      <CampoTexto id="email" rotulo="E-mail" icone={Mail} type="email" inputMode="email" autoComplete="email"
        autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="voce@empresa.com.br" />
      <CampoTexto id="telefone" rotulo="Telefone (WhatsApp)" icone={Phone} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} placeholder="(11) 91234-5678" />
      <div className="flex flex-col gap-3">
        <CampoSenha id="senha" rotulo="Senha" icone={Lock} autoComplete="new-password" required maxLength={72} medidor onChange={(e) => setSenha(e.target.value)} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Requisitos da senha">
          {REQUISITOS_SENHA.map((r) => {
            const ok = r.ok(senha);
            return (
              <li key={r.id} className={`flex items-center gap-1.5 transition-colors ${ok ? "text-emerald-700" : "text-slate-500"}`}>
                <Check className={`size-3.5 ${ok ? "opacity-100" : "opacity-30"}`} aria-hidden />
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
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm leading-relaxed text-slate-600">
        <input type="checkbox" name="termos" required className="mt-0.5 size-5 shrink-0 rounded-md border-slate-300 accent-marca" />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="font-medium text-marca-texto underline-offset-2 hover:underline">termos de uso</Link> e a{" "}
          <Link href="/privacidade" target="_blank" className="font-medium text-marca-texto underline-offset-2 hover:underline">política de privacidade</Link>.
        </span>
      </label>
      {estado.erro && <MensagemErro>{estado.erro}</MensagemErro>}
      <BotaoPrincipal carregando={enviando}>{enviando ? "Criando conta..." : "Criar minha conta"}</BotaoPrincipal>
    </form>
  );
}
