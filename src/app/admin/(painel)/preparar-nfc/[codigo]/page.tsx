import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina, Painel } from "@/components/admin/ui";
import { BotaoCopiar } from "@/components/admin/botao-copiar";
import { exigirAdmin } from "@/lib/auth";
import { buscarPlacaPorCodigo } from "@/lib/placas/consultas";
import { marcosNfc, ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";
import { urlNfc } from "@/lib/placas/urls";
import { EtapasTag } from "./etapas-tag";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza",
});

async function Detalhe({ params }: { params: PageProps<"/admin/preparar-nfc/[codigo]">["params"] }) {
  const { codigo } = await params;
  const { supabase } = await exigirAdmin(`${ROTA_PREPARO_NFC}/${encodeURIComponent(codigo)}`);
  const busca = await buscarPlacaPorCodigo(supabase, codigo);
  if (!busca.ok) {
    if (busca.status === 500) throw new Error("Falha ao consultar tag NFC");
    notFound();
  }
  const tag = busca.dado;
  if (!tag.preparada_nfc) notFound();
  const url = urlNfc(tag.codigo);
  const qr = `/api/admin/placas/${tag.codigo}/qr`;

  return (
    <>
      <CabecalhoPagina titulo={`Tag ${tag.codigo}`}
        sobretitulo={<Link href={ROTA_PREPARO_NFC}>Preparar NFC</Link>}
        descricao={tag.status === "desativada" ? "Esta tag está desativada." : undefined} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Painel className="space-y-4 p-5">
          <h2 className="font-semibold">Endereço permanente</h2>
          {!url.startsWith("https://") && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Endereço de desenvolvimento. Configure o domínio público em HTTPS antes de gravar tags para clientes.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="break-all text-sm text-marca-texto underline">{url}</a>
            <BotaoCopiar texto={url} rotulo="URL NFC" />
          </div>
          {/* API autenticada que gera o QR sob demanda. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR Code da tag ${tag.codigo}`} width={152} height={152} />
          <a className="text-sm text-marca-texto underline" href={`${qr}?formato=png&baixar=1`}>Baixar QR Code</a>
        </Painel>
        <Painel className="space-y-4 p-5">
          <h2 className="font-semibold">Etapas da tag</h2>
          <ol className="divide-y text-sm">
            {marcosNfc(tag).map(({ rotulo, data }) => (
              <li key={rotulo} className="flex justify-between gap-3 py-2">
                <span className="font-medium">{rotulo}</span>
                {data
                  ? <time dateTime={data}>{formatoData.format(new Date(data))}</time>
                  : <span className="text-muted-foreground">Pendente</span>}
              </li>
            ))}
          </ol>
          <EtapasTag codigo={tag.codigo} url={url} gravada={Boolean(tag.nfc_gravado_em)}
            testada={Boolean(tag.nfc_testada_em)} entregue={Boolean(tag.nfc_entregue_em)}
            encerrada={tag.status === "ativa" || tag.status === "desativada"} />
        </Painel>
      </div>
    </>
  );
}

export default function TagNfc({ params }: PageProps<"/admin/preparar-nfc/[codigo]">) {
  return <Suspense fallback={<p>Carregando tag...</p>}><Detalhe params={params} /></Suspense>;
}
