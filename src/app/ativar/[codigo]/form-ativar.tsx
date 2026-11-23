"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock, Mail, MapPin, Phone, Search, Star, User, Zap } from "lucide-react";
import { BotaoPrincipal, CampoSenha, CampoTexto, MensagemErro } from "@/components/auth/campos";
import type { DetalhesEmpresa, EmpresaEncontrada } from "@/lib/google/places";
import {
  ativarComGoogle,
  ativarComLink,
  criarContaCliente,
  entrarComSenha,
  identificarEmail,
  pesquisarEmpresa,
  verDetalhesEmpresa,
} from "./acoes";

type Etapa = "email" | "senha" | "cadastro" | "empresa" | "confirmar" | "manual" | "ativada";

const classeBusca =
  "h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-12 pl-4 text-base outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10";

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Nota ${nota.toFixed(1)}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-4 ${i <= Math.round(nota) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden />
      ))}
      <span className="ml-1 text-sm font-medium text-slate-700">{nota.toFixed(1)}</span>
    </span>
  );
}

export function FormAtivar({ codigo, logado }: { codigo: string; logado: boolean }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>(logado ? "empresa" : "email");
  const [email, setEmail] = useState("");
  const [consulta, setConsulta] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaEncontrada[] | null>(null);
  const [empresa, setEmpresa] = useState<DetalhesEmpresa | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();

  function executar(tarefa: () => Promise<void>) {
    setErro("");
    iniciar(async () => {
      try {
        await tarefa();
      } catch {
        setErro("Não foi possível concluir. Tente novamente.");
      }
    });
  }

  const enviar = (evento: FormEvent<HTMLFormElement>, tarefa: (dados: FormData) => Promise<void>) => {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    executar(() => tarefa(dados));
  };

  const voltar = (para: Etapa) => (
    <button type="button" onClick={() => { setErro(""); setEtapa(para); }} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
      <ArrowLeft className="size-4" aria-hidden /> Voltar
    </button>
  );

  const aviso = erro && <MensagemErro>{erro}</MensagemErro>;

  if (etapa === "email") {
    return (
      <form className="flex flex-col gap-5" noValidate onSubmit={(e) => enviar(e, async (d) => {
        const valor = String(d.get("email") ?? "").trim().toLowerCase();
        const r = await identificarEmail(valor);
        if ("erro" in r) return setErro(r.erro);
        setEmail(valor);
        setEtapa(r.tipo === "entrar" ? "senha" : "cadastro");
      })}>
        <p className="text-sm text-slate-500">Primeiro, seu e-mail. Se ainda não tiver conta, você cria em seguida.</p>
        <CampoTexto id="email" rotulo="Seu e-mail" icone={Mail} type="email" inputMode="email" autoComplete="email" required placeholder="voce@empresa.com" defaultValue={email} />
        {aviso}
        <BotaoPrincipal carregando={ocupado}>Continuar</BotaoPrincipal>
      </form>
    );
  }

  if (etapa === "senha") {
    return (
      <form className="flex flex-col gap-5" noValidate onSubmit={(e) => enviar(e, async (d) => {
        const r = await entrarComSenha(email, String(d.get("senha") ?? ""));
        if ("erro" in r) return setErro(r.erro);
        setEtapa("empresa");
        router.refresh();
      })}>
        <div>{voltar("email")}<p className="text-sm text-slate-500">Bem-vindo de volta, <strong className="text-slate-800">{email}</strong>.</p></div>
        <CampoSenha id="senha" rotulo="Senha" icone={Lock} autoComplete="current-password" required placeholder="Sua senha" />
        {aviso}
        <BotaoPrincipal carregando={ocupado}>Entrar e ativar</BotaoPrincipal>
      </form>
    );
  }

  if (etapa === "cadastro") {
    return (
      <form className="flex flex-col gap-5" noValidate onSubmit={(e) => enviar(e, async (d) => {
        const r = await criarContaCliente({
          nome: String(d.get("nome") ?? ""),
          email,
          telefone: String(d.get("telefone") ?? ""),
          senha: String(d.get("senha") ?? ""),
        });
        if ("erro" in r) return setErro(r.erro);
        setEtapa("empresa");
        router.refresh();
      })}>
        <div>{voltar("email")}<p className="text-sm text-slate-500">Criar conta com <strong className="text-slate-800">{email}</strong>.</p></div>
        <CampoTexto id="nome" rotulo="Seu nome" icone={User} autoComplete="name" required placeholder="Nome completo" />
        <CampoTexto id="telefone" rotulo="Telefone (opcional)" icone={Phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" />
        <CampoSenha id="senha" rotulo="Crie uma senha" icone={Lock} autoComplete="new-password" required placeholder="Mínimo de 10 caracteres" medidor />
        {aviso}
        <BotaoPrincipal carregando={ocupado}>Criar conta e continuar</BotaoPrincipal>
      </form>
    );
  }

  if (etapa === "confirmar" && empresa) {
    return (
      <div className="flex flex-col gap-5">
        {voltar("empresa")}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-center text-lg font-semibold text-blue-700">Confirmar</p>
          <p className="text-center text-sm text-slate-500">Esse é o Google correto para ativação?</p>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p className="text-base font-semibold text-slate-900">{empresa.nome}</p>
            {typeof empresa.totalAvaliacoes === "number" && <p>Total de avaliações: {empresa.totalAvaliacoes.toLocaleString("pt-BR")}</p>}
            {typeof empresa.nota === "number" && <Estrelas nota={empresa.nota} />}
            {empresa.endereco && <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />{empresa.endereco}</p>}
            {empresa.telefone && <p className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />{empresa.telefone}</p>}
          </div>
        </div>
        {aviso}
        <BotaoPrincipal type="button" carregando={ocupado} onClick={() => executar(async () => {
          const r = await ativarComGoogle(codigo, empresa.id, empresa.nome);
          if ("erro" in r) return setErro(r.erro);
          setEtapa("ativada");
        })}>
          <Zap className="size-4" aria-hidden /> Ativar produto agora
        </BotaoPrincipal>
      </div>
    );
  }

  if (etapa === "manual") {
    return (
      <form className="flex flex-col gap-5" noValidate onSubmit={(e) => enviar(e, async (d) => {
        const r = await ativarComLink(codigo, String(d.get("nome") ?? ""), String(d.get("link") ?? ""));
        if ("erro" in r) return setErro(r.erro);
        setEtapa("ativada");
      })}>
        <div>
          {voltar("empresa")}
          <p className="font-semibold text-slate-900">Não encontrou seu negócio?</p>
          <p className="text-sm text-slate-500">Preencha com o nome da empresa e o link de avaliação copiado do Google Maps (Compartilhar, Copiar link).</p>
        </div>
        <CampoTexto id="nome" rotulo="Nome da empresa" icone={User} required placeholder="Ex.: Mecânica do João" />
        <CampoTexto id="link" rotulo="Link de avaliação" icone={MapPin} type="url" required placeholder="https://g.page/r/... ou https://maps.app.goo.gl/..." />
        {aviso}
        <BotaoPrincipal carregando={ocupado}><Zap className="size-4" aria-hidden /> Ativar produto agora</BotaoPrincipal>
      </form>
    );
  }

  if (etapa === "ativada") {
    return (
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
          <CheckCircle2 className="size-9 text-emerald-600" aria-hidden />
        </span>
        <p className="text-xl font-semibold text-slate-900">Placa ativada!</p>
        <p className="text-sm text-slate-500">A partir de agora, quem aproximar o celular ou ler o QR Code vai direto para a avaliação no Google.</p>
        <a href={`/t/${codigo}`} className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 font-semibold text-white">Testar agora</a>
      </div>
    );
  }

  // Etapa "empresa": busca no Google, como no fluxo de referência.
  return (
    <div className="flex flex-col gap-5">
      <form noValidate onSubmit={(e) => enviar(e, async () => {
        setEmpresas(null);
        const r = await pesquisarEmpresa(codigo, consulta);
        if ("erro" in r) return setErro(r.erro);
        setEmpresas(r.empresas);
      })}>
        <p className="mb-3 text-center text-xl font-semibold text-blue-700">Qual sua empresa?</p>
        <p className="mb-4 text-center text-sm text-slate-500">Digite o nome da sua empresa assim como está no Google.</p>
        <div className="relative">
          <input value={consulta} onChange={(e) => setConsulta(e.target.value)} className={classeBusca} placeholder="Digite o nome da sua empresa" aria-label="Nome da empresa" minLength={3} maxLength={180} />
          <button type="submit" disabled={ocupado} className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Buscar">
            <Search className="size-5" />
          </button>
        </div>
      </form>

      <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Dica:</strong> não encontrou de primeira? Acrescente a cidade ou o bairro ao nome da empresa para refinar a busca.
      </p>

      {ocupado && <p role="status" className="text-sm text-slate-500">Buscando...</p>}
      {aviso}
      {empresas?.length === 0 && <p className="text-sm text-slate-500">Nenhuma empresa encontrada. Tente incluir a cidade.</p>}
      {!!empresas?.length && (
        <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-live="polite">
          {empresas.map((e) => (
            <li key={e.id}>
              <button type="button" disabled={ocupado} onClick={() => executar(async () => {
                const r = await verDetalhesEmpresa(codigo, e.id);
                if ("erro" in r) return setErro(r.erro);
                setEmpresa(r.empresa);
                setEtapa("confirmar");
              })} className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50">
                <span className="block font-medium text-slate-900">{e.nome}</span>
                {e.endereco && <span className="block text-sm text-slate-500">{e.endereco}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => { setErro(""); setEtapa("manual"); }} className="text-sm font-medium text-blue-700 hover:underline">
        Não encontrou seu negócio? Cadastre pelo link
      </button>
    </div>
  );
}
