import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, ExternalLink, Printer } from "lucide-react";
import { BotaoCopiar } from "@/components/admin/botao-copiar";
import { ExcluirPlaca } from "@/components/admin/excluir-placa";
import { GravarNfc } from "@/components/admin/gravar-nfc";
import { PainelEstoque } from "@/components/admin/painel-estoque";
import { CabecalhoPagina, Painel, PilulaStatus, TituloPainel } from "@/components/admin/ui";
import { ArtePlaca } from "@/components/placa/arte-placa";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { buscarPlacaPorCodigo } from "@/lib/placas/consultas";
import { gerarQrSvg, svgParaDataUri } from "@/lib/placas/qr";
import { formatarData } from "@/lib/placas/rotulos";
import { urlNfc, urlQr } from "@/lib/placas/urls";
import { ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";
import type { AcaoHistorico } from "@/lib/supabase/tipos";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


const ROTULO_ACAO: Record<AcaoHistorico, string> = {
  criou: "Placa criada",
  gravou_nfc: "NFC gravado",
  travou_nfc: "NFC travado",
  ativou: "Ativada pelo cliente",
  trocou_destino: "Destino trocado",
  bloqueou: "Bloqueada",
  desbloqueou: "Desbloqueada",
  resetou: "Resetada",
  reservou: "Reservada",
  atribuiu: "Atribuída a um cliente",
  liberou: "Devolvida ao estoque",
  desativou: "Desativada",
  reativou: "Reativada",
  tentativa_negada: "Tentativa de ativação negada",
  reivindicou: "Assumida pelo cliente",
};

function LinhaUrl({ rotulo, url }: { rotulo: string; url: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{rotulo}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">{url}</code>
        <BotaoCopiar texto={url} rotulo={rotulo} />
      </div>
    </div>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export default async function DetalhePlaca({ params, searchParams }: PageProps<"/admin/placas/[codigo]">) {
  const { codigo: codigoBruto } = await params;
  const { supabase } = await exigirAdmin(`/admin/placas/${codigoBruto}`);

  const busca = await buscarPlacaPorCodigo(supabase, codigoBruto);
  if (!busca.ok) {
    if (busca.status === 500) throw new Error("Falha ao carregar a placa");
    notFound();
  }
  const placa = busca.dado;
  if (placa.codigo !== codigoBruto) redirect(`/admin/placas/${placa.codigo}`);

  const { criada } = await searchParams;
  const [qrSvg, lote, empresa, dono, historico, leituras] = await Promise.all([
    gerarQrSvg(urlQr(placa.codigo)),
    placa.lote_id
      ? supabase.from("lotes").select("id, nome").eq("id", placa.lote_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    placa.empresa_id
      ? supabase.from("empresas").select("nome, origem, google_place_id").eq("id", placa.empresa_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    placa.dono_id
      ? supabase.from("perfis").select("id, nome, email").eq("id", placa.dono_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    supabase
      .from("historico_placa")
      .select("id, acao, criado_em")
      .eq("placa_id", placa.id)
      .order("criado_em", { ascending: false })
      .limit(20)
      .then((r) => r.data ?? []),
    supabase
      .from("leituras")
      .select("id", { count: "exact", head: true })
      .eq("placa_id", placa.id)
      .then((r) => r.count ?? 0),
  ]);
  const qrDataUri = svgParaDataUri(qrSvg);
  const base = `/api/admin/placas/${placa.codigo}`;

  return (
    <div>
      <Link href="/admin/placas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Placas
      </Link>

      {criada === "1" && (
        <div role="status" className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden />
          Placa criada. Baixe o QR para impressão e grave o NFC.
        </div>
      )}

      <CabecalhoPagina
        sobretitulo={lote ? <Link href={`/admin/lotes/${lote.id}`} className="hover:underline">{lote.nome}</Link> : "Placa avulsa"}
        titulo={<span className="font-mono tracking-[0.18em]">{placa.codigo}</span>}
        descricao={`Criada em ${formatarData(placa.criado_em)} · ${leituras.toLocaleString("pt-BR")} leituras`}
        acoes={<PilulaStatus status={placa.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Painel>
            <TituloPainel titulo="Arte da placa" descricao="PNG em 2000 × 2000 px; PDF pela folha de impressão." />
            <div className="flex flex-col items-center gap-5 px-5 pb-6 sm:px-6">
              <div className="w-full max-w-[340px] overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
                <ArtePlaca codigo={placa.codigo} qrDataUri={qrDataUri} tamanho={340} />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <a href={`${base}/arte?baixar=1`} className={buttonVariants({ variant: "outline" })}>
                  <Download aria-hidden /> Arte PNG
                </a>
                <a href={`${base}/qr?formato=svg&baixar=1`} className={buttonVariants({ variant: "outline" })}>
                  <Download aria-hidden /> QR SVG
                </a>
                <a href={`${base}/qr?formato=png&tamanho=1024&baixar=1`} className={buttonVariants({ variant: "outline" })}>
                  <Download aria-hidden /> QR PNG
                </a>
                <Link href={`/admin/impressao?codigo=${placa.codigo}`} className={buttonVariants({ variant: "outline" })}>
                  <Printer aria-hidden /> Imprimir / PDF
                </Link>
              </div>
            </div>
          </Painel>

          <Painel>
            <TituloPainel titulo="Vínculo" />
            <dl className="divide-y divide-slate-100 px-5 pb-3 sm:px-6">
              <Dado rotulo="Cliente">
                {dono ? (
                  <Link href={`/admin/usuarios/${dono.id}`} className="text-marca-texto hover:underline">
                    {dono.nome ?? dono.email}
                  </Link>
                ) : (
                  <span className="text-slate-400">Sem dono</span>
                )}
              </Dado>
              <Dado rotulo="Empresa">{empresa?.nome ?? <span className="text-slate-400">Nenhuma</span>}</Dado>
              <Dado rotulo="Origem">
                {empresa ? (empresa.origem === "google_places" ? "Google (Place ID)" : "Link manual") : <span className="text-slate-400">-</span>}
              </Dado>
              <Dado rotulo="Atribuída em">{placa.atribuida_em ? formatarData(placa.atribuida_em) : <span className="text-slate-400">-</span>}</Dado>
              <Dado rotulo="Ativada em">{placa.ativada_em ? formatarData(placa.ativada_em) : <span className="text-slate-400">Não ativada</span>}</Dado>
              <Dado rotulo="Destino">
                {placa.destino_url ? (
                  <a href={placa.destino_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-marca-texto hover:underline">
                    Abrir avaliação <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  <span className="text-slate-400">Sem destino</span>
                )}
              </Dado>
            </dl>
          </Painel>
        </div>

        <div className="flex flex-col gap-6">
          <Painel>
            <TituloPainel titulo="Estoque e situação" />
            <div className="px-5 pb-6 sm:px-6">
              <PainelEstoque
                placaId={placa.id}
                codigo={placa.codigo}
                status={placa.status}
                reservadaPara={placa.reservada_para}
                cliente={dono ? { nome: dono.nome, email: dono.email } : null}
              />
            </div>
          </Painel>

          <Painel>
            <TituloPainel
              titulo="NFC e links"
              descricao={
                placa.nfc_travado
                  ? `Chip travado. Gravado em ${formatarData(placa.nfc_gravado_em)}.`
                  : placa.nfc_gravado_em
                    ? `Gravado em ${formatarData(placa.nfc_gravado_em)}, ainda não travado.`
                    : "Chip ainda não gravado."
              }
            />
            <div className="flex flex-col gap-4 px-5 pb-6 sm:px-6">
              <LinhaUrl rotulo="URL do NFC" url={urlNfc(placa.codigo)} />
              <LinhaUrl rotulo="URL do QR" url={urlQr(placa.codigo)} />
              {placa.preparada_nfc ? (
                <Link className="text-sm font-medium text-marca-texto underline" href={`${ROTA_PREPARO_NFC}/${placa.codigo}`}>
                  Acompanhar preparo da tag
                </Link>
              ) : (
                <GravarNfc placaId={placa.id} url={urlNfc(placa.codigo)} gravadoEm={placa.nfc_gravado_em} travado={placa.nfc_travado} />
              )}
            </div>
          </Painel>

          <Painel>
            <TituloPainel titulo="Histórico" />
            {historico.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-500 sm:px-6">Sem eventos.</p>
            ) : (
              <ol className="relative mx-5 mb-5 border-l border-slate-200 sm:mx-6">
                {historico.map((h) => (
                  <li key={h.id} className="relative pb-4 pl-5 last:pb-0">
                    <span aria-hidden className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-white bg-marca" />
                    <p className="text-sm font-medium text-slate-800">{ROTULO_ACAO[h.acao]}</p>
                    <time className="text-xs text-slate-500" dateTime={h.criado_em}>
                      {formatarData(h.criado_em)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Painel>

          {!(placa.preparada_nfc && placa.nfc_gravado_em) && (
            <Painel className="border-red-100">
              <TituloPainel titulo="Zona de perigo" descricao="Só administradores podem apagar placas." />
              <div className="px-5 pb-6 sm:px-6">
                <ExcluirPlaca placaId={placa.id} codigo={placa.codigo} ativa={placa.status === "ativa"} />
              </div>
            </Painel>
          )}
        </div>
      </div>
    </div>
  );
}
