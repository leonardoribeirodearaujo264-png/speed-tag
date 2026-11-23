"use client";

import { useState, useTransition, type ReactNode } from "react";
import { CheckCircle2, Copy, ExternalLink, Link2, Loader2, MapPin, Phone, Search, ShieldAlert, Star, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  gerarLinkAvaliacao,
  pesquisarEmpresas,
  testarLinkAvaliacao,
  type ResultadoVinculo,
  type Vinculo,
} from "@/lib/acoes/link-avaliacao";
import type { EmpresaGerada } from "@/lib/google/gerador";
import type { VerificacaoLink } from "@/lib/google/links-maps";
import type { EmpresaEncontrada } from "@/lib/google/places";

type Aba = "nome" | "link" | "manual";

const campo = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-marca focus:ring-4 focus:ring-marca/15";
const rotuloCampo = "flex flex-col gap-1.5 text-sm font-medium text-slate-700";

function SeloTeste({ teste }: { teste: VerificacaoLink | null }) {
  if (!teste) return null;
  const estilo =
    teste.estado === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : teste.estado === "invalido"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-800";
  const Icone = teste.estado === "ok" ? CheckCircle2 : ShieldAlert;
  return (
    <p role="status" className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-medium ${estilo}`}>
      <Icone className="mt-px size-4 shrink-0" aria-hidden /> {teste.detalhe}
    </p>
  );
}

/** Mostra o link gerado com Copiar e Testar avaliação. */
function LinkGerado({ link, teste, aoTestar, testando }: { link: string; teste: VerificacaoLink | null; aoTestar: () => void; testando: boolean }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Link para avaliar</span>
      <code className="block truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700" title={link}>{link}</code>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => void copiar()}><Copy /> Copiar link</Button>
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-8" onClick={aoTestar} disabled={testando}>
          {testando ? <Loader2 className="animate-spin" /> : <ExternalLink />} Testar avaliação
        </Button>
      </div>
      <SeloTeste teste={teste} />
    </div>
  );
}

/**
 * Gerador de link de avaliação do Google: busca pelo nome, link colado do Maps (inclusive
 * curto) ou cadastro manual. Mostra a empresa para confirmar, gera o link direto de
 * avaliação e vincula à placa pela função recebida em `aoVincular`.
 */
export function GeradorLink({ aoVincular, rotuloVincular = "Vincular à plaquinha", antesDeVincular, aoConcluir }: {
  aoVincular: (vinculo: Vinculo) => Promise<ResultadoVinculo>;
  rotuloVincular?: string;
  /** Campos extras mostrados acima do botão de vincular (ex.: e-mail do cliente). */
  antesDeVincular?: ReactNode;
  aoConcluir?: () => void;
}) {
  const [aba, setAba] = useState<Aba>("nome");
  const [consulta, setConsulta] = useState("");
  const [linkMaps, setLinkMaps] = useState("");
  const [resultados, setResultados] = useState<EmpresaEncontrada[] | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaGerada | null>(null);
  const [nomeManual, setNomeManual] = useState("");
  const [linkManual, setLinkManual] = useState("");
  const [teste, setTeste] = useState<VerificacaoLink | null>(null);
  const [carregando, setCarregando] = useState<"busca" | "gerar" | "teste" | null>(null);
  const [vinculando, iniciar] = useTransition();

  function trocarAba(nova: Aba) {
    setAba(nova);
    setEmpresa(null);
    setTeste(null);
  }

  async function buscar() {
    setCarregando("busca");
    setEmpresa(null);
    setTeste(null);
    const r = await pesquisarEmpresas(consulta);
    setCarregando(null);
    if ("erro" in r) {
      toast.error(r.erro);
      setResultados(null);
    } else {
      setResultados(r.empresas);
    }
  }

  async function gerar(entrada: { placeId: string } | { link: string }) {
    setCarregando("gerar");
    setTeste(null);
    const r = await gerarLinkAvaliacao(entrada);
    setCarregando(null);
    if ("erro" in r) {
      toast.error(r.erro);
      return;
    }
    setEmpresa(r.empresa);
    setResultados(null);
  }

  const linkAtual = aba === "manual" ? linkManual.trim() : empresa?.linkAvaliacao ?? "";

  async function testar() {
    if (!linkAtual) return;
    // Abre já no clique (o navegador bloqueia janela aberta depois de await).
    window.open(linkAtual, "_blank", "noopener,noreferrer");
    setCarregando("teste");
    setTeste(await testarLinkAvaliacao(linkAtual));
    setCarregando(null);
  }

  function vincular() {
    const vinculo: Vinculo | null =
      aba === "manual"
        ? { tipo: "manual", nome: nomeManual, link: linkManual }
        : empresa
          ? { tipo: "google", placeId: empresa.id, nome: empresa.nome, link: empresa.linkAvaliacao }
          : null;
    if (!vinculo) return;
    iniciar(async () => {
      const r = await aoVincular(vinculo);
      if (r.ok) {
        toast.success(r.mensagem);
        aoConcluir?.();
      } else {
        toast.error(r.mensagem);
      }
    });
  }

  const estiloAba = (ativa: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg px-1.5 py-1 text-center text-[13px] leading-tight font-medium transition-colors sm:min-h-9 ${ativa ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`;
  const podeVincular = aba === "manual" ? nomeManual.trim().length > 0 && linkManual.trim().length > 0 : !!empresa;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Como encontrar a empresa">
        <button type="button" role="tab" aria-selected={aba === "nome"} className={estiloAba(aba === "nome")} onClick={() => trocarAba("nome")}>Buscar pelo nome</button>
        <button type="button" role="tab" aria-selected={aba === "link"} className={estiloAba(aba === "link")} onClick={() => trocarAba("link")}>Colar link do Maps</button>
        <button type="button" role="tab" aria-selected={aba === "manual"} className={estiloAba(aba === "manual")} onClick={() => trocarAba("manual")}>Link manual</button>
      </div>

      {aba === "nome" && !empresa && (
        <>
          <div className="flex gap-2">
            <input
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (consulta.trim().length >= 3) void buscar();
                }
              }}
              placeholder="Nome da empresa e cidade"
              aria-label="Nome da empresa e cidade"
              className={`${campo} min-w-0`}
            />
            <Button type="button" className="size-11 shrink-0" disabled={carregando !== null || consulta.trim().length < 3} onClick={() => void buscar()} aria-label="Buscar">
              {carregando === "busca" ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>
          {resultados !== null &&
            (resultados.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">Nada encontrado. Tente outro nome, cole o link do Maps ou use o link manual.</p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto" aria-label="Empresas encontradas">
                {resultados.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={carregando !== null}
                      onClick={() => void gerar({ placeId: r.id })}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-marca-borda hover:bg-marca-claro/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium text-slate-900">{r.nome}</span>
                        {r.endereco && <span className="block truncate text-xs text-slate-500">{r.endereco}</span>}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-marca-texto">Gerar link</span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}

      {aba === "link" && !empresa && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void gerar({ link: linkMaps });
          }}
        >
          <label className={rotuloCampo}>
            Link do Google Maps
            <input value={linkMaps} onChange={(e) => setLinkMaps(e.target.value)} placeholder="https://maps.app.goo.gl/..." className={campo} inputMode="url" />
          </label>
          <p className="text-xs text-slate-500">No Maps, abra a empresa, toque em Compartilhar e copie o link. Links curtos funcionam.</p>
          <Button type="submit" className="min-h-11 sm:min-h-9" disabled={carregando !== null || linkMaps.trim().length < 8}>
            {carregando === "gerar" ? <Loader2 className="animate-spin" /> : <Wand2 />} Gerar link
          </Button>
        </form>
      )}

      {carregando === "gerar" && aba === "nome" && (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Gerando o link de avaliação...</p>
      )}

      {empresa && aba !== "manual" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-marca-borda bg-marca-claro/40 p-4">
          <div>
            <p className="break-words text-base font-semibold text-slate-900">{empresa.nome}</p>
            {empresa.endereco && <p className="mt-0.5 flex items-start gap-1.5 text-sm text-slate-600"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {empresa.endereco}</p>}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {empresa.nota !== undefined && (
                <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden /> {empresa.nota.toLocaleString("pt-BR")} ({(empresa.totalAvaliacoes ?? 0).toLocaleString("pt-BR")} avaliações)</span>
              )}
              {empresa.telefone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" aria-hidden /> {empresa.telefone}</span>}
            </div>
          </div>
          {empresa.aproximado && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">O link colado não trazia o código da empresa; encontramos pelo nome e local. Confira se é a empresa certa.</p>
          )}
          <LinkGerado link={empresa.linkAvaliacao} teste={teste} aoTestar={() => void testar()} testando={carregando === "teste"} />
          <button type="button" className="-mx-1 inline-flex min-h-11 items-center self-start px-1 text-xs font-medium text-slate-500 underline hover:text-slate-800 sm:min-h-0" onClick={() => trocarAba(aba)}>
            Não é esta empresa
          </button>
        </div>
      )}

      {aba === "manual" && (
        <div className="flex flex-col gap-3">
          <label className={rotuloCampo}>
            Nome da empresa
            <input value={nomeManual} onChange={(e) => setNomeManual(e.target.value)} maxLength={200} className={campo} />
          </label>
          <label className={rotuloCampo}>
            Link de avaliação do Google
            <input value={linkManual} onChange={(e) => { setLinkManual(e.target.value); setTeste(null); }} placeholder="https://g.page/r/.../review" className={campo} inputMode="url" />
          </label>
          {linkManual.trim().startsWith("https://") && (
            <LinkGerado link={linkManual.trim()} teste={teste} aoTestar={() => void testar()} testando={carregando === "teste"} />
          )}
        </div>
      )}

      {podeVincular && (
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
          {antesDeVincular}
          <Button type="button" size="lg" className="min-h-11" onClick={vincular} disabled={vinculando || teste?.estado === "invalido"}>
            {vinculando ? <Loader2 className="animate-spin" /> : <Link2 />} {rotuloVincular}
          </Button>
          <p className="text-center text-xs text-slate-500">O link é testado no servidor antes de salvar. A tag NFC não precisa ser regravada.</p>
        </div>
      )}
    </div>
  );
}
