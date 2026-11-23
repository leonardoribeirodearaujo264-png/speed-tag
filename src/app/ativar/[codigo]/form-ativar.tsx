"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Lightbulb, Link2, Loader2, Mail, MapPin, Search, Star, Zap } from "lucide-react";
import type { DetalhesEmpresa, EmpresaEncontrada } from "@/lib/google/places";
import { ativarComGoogle, ativarComLink, pesquisarEmpresa, verDetalhesEmpresa, type ResultadoAtivacao } from "./acoes";

type Escolha = { tipo: "google"; empresa: DetalhesEmpresa } | { tipo: "manual"; nome: string; link: string };
type Etapa = "empresa" | "manual" | "quase" | "sucesso";

const campo =
  "h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-marca focus:bg-white focus:ring-4 focus:ring-marca/15";

function Estrelas({ nota, total }: { nota: number; total?: number }) {
  return (
    <span className="flex items-center gap-1 text-sm text-slate-600" aria-label={`Nota ${nota.toFixed(1)}`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`size-4 ${i <= Math.round(nota) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden />
        ))}
      </span>
      <span className="font-medium text-slate-800">{nota.toFixed(1)}</span>
      {typeof total === "number" && <span>({total.toLocaleString("pt-BR")})</span>}
    </span>
  );
}

function BotaoAzul({ carregando, disabled, children, ...props }: React.ComponentProps<"button"> & { carregando?: boolean }) {
  return (
    <button
      {...props}
      disabled={carregando || disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-marca to-[#1a8cff] text-[15px] font-semibold text-white shadow-lg shadow-marca/30 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

const ETAPAS = ["Empresa", "E-mail", "Pronto"] as const;

function Progresso({ atual }: { atual: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label={`Etapa ${Math.min(atual + 1, ETAPAS.length)} de ${ETAPAS.length}`}>
      {ETAPAS.map((rotulo, i) => (
        <li key={rotulo} className="flex flex-1 items-center gap-2">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition ${
              i < atual ? "bg-emerald-500 text-white" : i === atual ? "bg-marca text-white ring-4 ring-marca/15" : "bg-slate-100 text-slate-400"
            }`}
          >
            {i < atual ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={`text-xs font-medium ${i === atual ? "text-slate-900" : "text-slate-400"}`}>{rotulo}</span>
          {i < ETAPAS.length - 1 && <span className={`h-px flex-1 ${i < atual ? "bg-emerald-300" : "bg-slate-200"}`} />}
        </li>
      ))}
    </ol>
  );
}

function Erro({ texto }: { texto: string }) {
  return texto ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{texto}</p> : null;
}

/** Tela verde de sucesso, depois a mensagem sobre o acesso por e-mail (como no vídeo de referência). */
function Sucesso({ codigo, emailEnviado, email }: { codigo: string; emailEnviado: boolean; email: string }) {
  const [verde, setVerde] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVerde(false), 2600);
    return () => clearTimeout(t);
  }, []);

  if (verde) {
    return (
      <div role="status" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#22c55e] px-8 text-center animate-in fade-in">
        <CheckCircle2 className="size-20 text-white" strokeWidth={1.5} aria-hidden />
        <p className="text-3xl leading-tight font-bold text-white">Produto ativado com sucesso!</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 text-center animate-in fade-in" role="status">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
        <CheckCircle2 className="size-9 text-emerald-600" aria-hidden />
      </span>
      <p className="text-xl font-semibold tracking-tight text-slate-900">Placa ativada!</p>
      <p className="text-sm leading-relaxed text-slate-500">
        A partir de agora, quem aproximar o celular ou ler o QR Code vai direto para a avaliação no Google.
      </p>
      <p className="rounded-xl bg-marca-claro px-4 py-3 text-sm leading-relaxed text-marca-texto ring-1 ring-marca-borda">
        {emailEnviado
          ? <>Enviamos para <strong>{email}</strong> o link para acessar nossa plataforma e gerenciar seus produtos.</>
          : <>Para acessar nossa plataforma e gerenciar seus produtos, entre com o e-mail <strong>{email}</strong> na área do cliente.</>}
      </p>
      <a href={`/t/${codigo}`} className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-marca to-[#1a8cff] font-semibold text-white shadow-lg shadow-marca/30">
        Testar agora
      </a>
    </div>
  );
}

export function FormAtivar({ codigo }: { codigo: string }) {
  const [etapa, setEtapa] = useState<Etapa>("empresa");
  const [consulta, setConsulta] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaEncontrada[] | null>(null);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [email, setEmail] = useState("");
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  // Uma sessão do Google por tentativa: agrupa buscas e a escolha da empresa na cobrança.
  const [sessao] = useState(() => crypto.randomUUID());
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

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    executar(async () => {
      setEmpresas(null);
      const r = await pesquisarEmpresa(codigo, consulta, sessao);
      if ("erro" in r) return setErro(r.erro);
      setEmpresas(r.empresas);
    });
  }

  function concluir(r: ResultadoAtivacao) {
    if ("erro" in r) return setErro(r.erro);
    setEmailEnviado(r.emailEnviado);
    setEtapa("sucesso");
  }

  if (etapa === "sucesso") return <Sucesso codigo={codigo} emailEnviado={emailEnviado} email={email} />;

  if (etapa === "quase" && escolha) {
    return (
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          executar(async () =>
            concluir(
              escolha.tipo === "google"
                ? await ativarComGoogle(codigo, email, escolha.empresa.id, escolha.empresa.nome)
                : await ativarComLink(codigo, email, escolha.nome, escolha.link),
            ),
          );
        }}
      >
        <Progresso atual={1} />
        <button type="button" onClick={() => { setErro(""); setEtapa(escolha.tipo === "google" ? "empresa" : "manual"); }} className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> Voltar
        </button>
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">Quase lá!</p>
          <p className="mt-1 text-sm text-slate-500">Informe seu e-mail para concluir a ativação.</p>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          E-mail
          <span className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={`${campo} pl-11`} />
          </span>
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          {escolha.tipo === "google" ? (
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-900">{escolha.empresa.nome}</p>
              {typeof escolha.empresa.nota === "number" && <Estrelas nota={escolha.empresa.nota} total={escolha.empresa.totalAvaliacoes} />}
              {escolha.empresa.endereco && (
                <p className="flex gap-1.5 text-sm text-slate-500"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{escolha.empresa.endereco}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-900">{escolha.nome}</p>
              <p className="flex gap-1.5 text-sm break-all text-slate-500"><Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />{escolha.link}</p>
            </div>
          )}
        </div>

        <Erro texto={erro} />
        <BotaoAzul type="submit" carregando={ocupado} disabled={!email.trim()}>
          <Zap className="size-4" aria-hidden /> Ativar produto
        </BotaoAzul>
      </form>
    );
  }

  if (etapa === "manual") {
    return (
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          const dados = new FormData(e.currentTarget);
          setErro("");
          setEscolha({ tipo: "manual", nome: String(dados.get("nome") ?? "").trim(), link: String(dados.get("link") ?? "").trim() });
          setEtapa("quase");
        }}
      >
        <Progresso atual={0} />
        <button type="button" onClick={() => { setErro(""); setEtapa("empresa"); }} className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> Voltar para a busca
        </button>
        <div>
          <p className="text-xl font-semibold tracking-tight text-slate-900">Não encontrou seu negócio?</p>
          <p className="mt-1 text-sm text-slate-500">Preencha com o nome da empresa e o link de avaliação.</p>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Nome da empresa
          <input name="nome" required minLength={2} maxLength={200} defaultValue={escolha?.tipo === "manual" ? escolha.nome : ""} className={campo} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Link de avaliação
          <input name="link" type="url" required maxLength={2048} placeholder="https://g.page/r/... ou https://maps.app.goo.gl/..." defaultValue={escolha?.tipo === "manual" ? escolha.link : ""} className={campo} />
          <span className="text-xs font-normal text-slate-500">No Google Maps, abra sua empresa, toque em Compartilhar e copie o link.</span>
        </label>
        <BotaoAzul type="submit">Continuar</BotaoAzul>
      </form>
    );
  }

  // "Qual sua empresa?"
  return (
    <div className="flex flex-col gap-5">
      <Progresso atual={0} />
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight text-slate-900">Qual sua empresa?</p>
        <p className="mt-1 text-sm text-slate-500">Digite o nome da sua empresa assim como está no Google.</p>
      </div>

      <form onSubmit={buscar} className="relative" noValidate>
        <MapPin className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Ex.: Padaria Pão Quente, Piracicaba"
          aria-label="Nome da empresa"
          maxLength={180}
          className={`${campo} pr-12 pl-11`}
        />
        <button type="submit" disabled={ocupado} aria-label="Buscar" className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg bg-marca text-white shadow-sm transition hover:brightness-110">
          {ocupado && !empresas ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
        </button>
      </form>

      <p className="-mt-2 flex gap-2 text-[13px] leading-relaxed text-slate-500">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
        <span><strong className="font-medium text-slate-700">Dica:</strong> não encontrou de primeira? Acrescente a cidade ou o bairro ao nome da empresa para refinar a busca.</span>
      </p>

      <Erro texto={erro} />

      {empresas?.length === 0 && <p className="text-center text-sm text-slate-500">Nenhuma empresa encontrada. Tente incluir a cidade.</p>}
      {!!empresas?.length && (
        <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200" aria-live="polite">
          {empresas.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  executar(async () => {
                    const r = await verDetalhesEmpresa(codigo, e.id, sessao);
                    if ("erro" in r) return setErro(r.erro);
                    setEscolha({ tipo: "google", empresa: r.empresa });
                    setEtapa("quase");
                  })
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-marca-claro disabled:opacity-60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-marca to-marca-ciano text-sm font-semibold text-white">
                  {e.nome.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{e.nome}</span>
                  {e.endereco && <span className="block truncate text-sm text-slate-500">{e.endereco}</span>}
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-5 text-sm">
        <button type="button" onClick={() => { setErro(""); setEtapa("manual"); }} className="font-medium text-marca-texto hover:underline">
          Não encontrou seu negócio?
        </button>
        <button type="button" onClick={() => setAjuda((v) => !v)} className="text-slate-500 underline-offset-2 hover:underline" aria-expanded={ajuda}>
          Precisa de ajuda?
        </button>
        {ajuda && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-left text-slate-600">
            Digite o nome da empresa como aparece no Google Maps e toque na lupa. Escolha sua empresa na lista e informe seu e-mail.
            Se ela não aparecer, use &quot;Não encontrou seu negócio?&quot; e cole o link de avaliação copiado do Google Maps.
          </p>
        )}
      </div>
    </div>
  );
}
