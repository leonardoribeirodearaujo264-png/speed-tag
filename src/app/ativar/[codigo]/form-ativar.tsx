"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, Check, ChevronRight, ExternalLink, Lightbulb, Loader2, Mail, MapPin, Search, Star, Wand2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EmpresaGerada } from "@/lib/google/gerador";
import type { EmpresaEncontrada } from "@/lib/google/places";
import { ativarComGoogle, identificarPorLink, pesquisarEmpresa, verDetalhesEmpresa, type ResultadoAtivacao } from "./acoes";

type Escolha = { empresa: EmpresaGerada; viaLink?: boolean };
type Etapa = "empresa" | "manual" | "quase";

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

export function FormAtivar({ codigo, email }: { codigo: string; email: string }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("empresa");
  const [consulta, setConsulta] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaEncontrada[] | null>(null);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [ajuda, setAjuda] = useState(false);
  const [linkMaps, setLinkMaps] = useState("");
  const [nomeManual, setNomeManual] = useState("");
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
    router.replace(`/painel/empresas?ativada=${encodeURIComponent(codigo)}`);
  }

  if (etapa === "quase" && escolha) {
    return (
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          executar(async () =>
            concluir(
              await ativarComGoogle(codigo, escolha.empresa.id, escolha.empresa.nome, escolha.empresa.linkAvaliacao),
            ),
          );
        }}
      >
        <Progresso atual={1} />
        <button type="button" onClick={() => { setErro(""); setEtapa(escolha.viaLink ? "manual" : "empresa"); }} className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> Voltar
        </button>
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">Quase lá!</p>
          <p className="mt-1 text-sm text-slate-500">Confirme a empresa e a conta que vai gerenciar a placa.</p>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          E-mail
          <span className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="email" value={email} readOnly className={`${campo} pl-11`} />
          </span>
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-900">{escolha.empresa.nome}</p>
              {typeof escolha.empresa.nota === "number" && <Estrelas nota={escolha.empresa.nota} total={escolha.empresa.totalAvaliacoes} />}
              {escolha.empresa.endereco && (
                <p className="flex gap-1.5 text-sm text-slate-500"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{escolha.empresa.endereco}</p>
              )}
              {escolha.empresa.aproximado && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Encontramos pelo nome e local do link. Confira se é a sua empresa.</p>
              )}
              <a href={escolha.empresa.linkAvaliacao} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-marca-texto hover:underline">
                Testar link de avaliação <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
        </div>

        <Erro texto={erro} />
        <BotaoAzul type="submit" carregando={ocupado} disabled={!email.trim()}>
          <Zap className="size-4" aria-hidden /> Ativar placa
        </BotaoAzul>
      </form>
    );
  }

  if (etapa === "manual") {
    return (
      <form className="flex flex-col gap-5" onSubmit={(evento) => {
        evento.preventDefault();
        executar(async () => {
          const r = await identificarPorLink(codigo, linkMaps.trim());
          if ("erro" in r) return setErro(r.erro);
          setEscolha({ empresa: { ...r.empresa, nome: nomeManual.trim() }, viaLink: true });
          setEtapa("quase");
        });
      }}>
        <Progresso atual={0} />
        <button type="button" onClick={() => { setErro(""); setEtapa("empresa"); }} className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> Voltar para a busca
        </button>
        <div>
          <p className="text-xl font-semibold tracking-tight text-slate-900">Não encontrou seu negócio?</p>
          <p className="mt-1 text-sm text-slate-500">Cole o link da sua empresa no Google Maps. A gente identifica e gera o link de avaliação.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-marca-borda bg-marca-claro/40 p-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Nome da empresa
            <input name="nome" required minLength={2} maxLength={200} value={nomeManual}
              onChange={(evento) => setNomeManual(evento.target.value)} className={campo} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Link do Google Maps
            <input value={linkMaps} onChange={(e) => setLinkMaps(e.target.value)} type="url" required maxLength={2048} placeholder="https://maps.app.goo.gl/..." className={campo} />
          </label>
          <span className="text-xs text-slate-500">No Google Maps, abra sua empresa, toque em Compartilhar e copie o link.</span>
          <BotaoAzul type="submit" carregando={ocupado} disabled={nomeManual.trim().length < 2 || linkMaps.trim().length < 8}>
            <Wand2 className="size-4" aria-hidden /> Gerar link de avaliação
          </BotaoAzul>
        </div>
        <Erro texto={erro} />
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
                    setEscolha({ empresa: r.empresa });
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
            Digite o nome da empresa como aparece no Google Maps e toque na lupa. Escolha sua empresa na lista e confirme a ativação.
            Se ela não aparecer, use &quot;Não encontrou seu negócio?&quot; e cole o link compartilhado do Google Maps.
          </p>
        )}
      </div>
    </div>
  );
}
