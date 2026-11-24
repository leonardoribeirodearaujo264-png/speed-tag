import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";
import { cn } from "cn";
import { BotaoCopiar } from "@/components/admin/botao-copiar";
import { CabecalhoPagina, Painel, TituloPainel } from "@/components/admin/ui";
import { exigirAdmin } from "@/lib/auth";
import { buscarPlacaPorCodigo } from "@/lib/placas/consultas";
import { marcosNfc, ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";
import { urlAtivacao, urlNfc } from "@/lib/placas/urls";
import { EtapasTag } from "./etapas-tag";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const PASSOS = [
  {
    titulo: "Gravar o endereço na tag",
    texto: "Grave o endereço permanente (abaixo) na tag NFC: pelo botão \"Gravar pelo navegador\" no Chrome do Android ou pelo app NFC Tools (Gravar > Adicionar registro > URL).",
  },
  {
    titulo: "Testar a tag",
    texto: "Aproxime a tag do celular. Ela deve abrir a página de ativação da Speed Tag com o código desta tag. Confirme o teste no painel.",
  },
  {
    titulo: "Registrar a entrega",
    texto: "Na hora de entregar a placa ao cliente, registre a entrega. A partir daí a placa fica liberada para ativação.",
  },
  {
    titulo: "Cliente ativa a placa",
    texto: "O cliente aproxima o celular ou lê o QR Code (ou abre o link de ativação que você enviou), entra com o e-mail e escolhe a empresa no Google.",
  },
] as const;

function passoAtual(tag: { nfc_gravado_em: string | null; nfc_testada_em: string | null; nfc_entregue_em: string | null; status: string }) {
  if (tag.status === "ativa") return PASSOS.length;
  if (!tag.nfc_gravado_em) return 0;
  if (!tag.nfc_testada_em) return 1;
  if (!tag.nfc_entregue_em) return 2;
  return 3;
}

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
  const ativacao = urlAtivacao(tag.codigo);
  const qr = `/api/admin/placas/${tag.codigo}/qr`;
  const atual = passoAtual(tag);
  const mensagemWhatsapp = encodeURIComponent(
    `Olá! Para ativar sua placa de avaliação Speed Tag (código ${tag.codigo}), abra este link, entre com seu e-mail e escolha sua empresa no Google: ${ativacao}`,
  );

  return (
    <div>
      <CabecalhoPagina
        sobretitulo={<Link href={ROTA_PREPARO_NFC} className="hover:underline">Preparar NFC</Link>}
        titulo={<span className="font-mono tracking-[0.15em]">Tag {tag.codigo}</span>}
        descricao={
          tag.status === "desativada"
            ? "Esta tag está desativada."
            : tag.status === "ativa"
              ? "Tag ativada pelo cliente. O endereço já leva direto para a avaliação no Google."
              : "Siga o passo a passo para gravar, testar e entregar esta tag."
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Painel>
            <TituloPainel titulo="Passo a passo" descricao={atual >= PASSOS.length ? "Concluído" : `Etapa ${atual + 1} de ${PASSOS.length}`} />
            <ol className="flex flex-col gap-1 px-5 pb-5 sm:px-6">
              {PASSOS.map((passo, i) => {
                const feito = i < atual;
                const agora = i === atual;
                return (
                  <li key={passo.titulo} className={cn("flex gap-4 rounded-xl p-3", agora && "bg-marca-claro ring-1 ring-marca-borda")}>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        feito ? "bg-emerald-500 text-white" : agora ? "bg-marca text-white" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {feito ? <Check className="size-4" aria-hidden /> : i + 1}
                    </span>
                    <div>
                      <p className={cn("font-medium", feito ? "text-slate-500" : "text-slate-900")}>{passo.titulo}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{passo.texto}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
              <EtapasTag
                codigo={tag.codigo}
                url={url}
                gravada={Boolean(tag.nfc_gravado_em)}
                testada={Boolean(tag.nfc_testada_em)}
                entregue={Boolean(tag.nfc_entregue_em)}
                encerrada={tag.status === "ativa" || tag.status === "desativada"}
              />
            </div>
          </Painel>

          <Painel>
            <TituloPainel titulo="Histórico da tag" />
            <ol className="divide-y divide-slate-100 px-5 pb-4 text-sm sm:px-6">
              {marcosNfc(tag).map(({ rotulo, data }) => (
                <li key={rotulo} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2.5">
                  <span className="font-medium text-slate-700">{rotulo}</span>
                  {data ? (
                    <time dateTime={data} className="text-slate-500">{formatoData.format(new Date(data))}</time>
                  ) : (
                    <span className="text-slate-400">Pendente</span>
                  )}
                </li>
              ))}
            </ol>
          </Painel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Painel>
            <TituloPainel titulo="Link de ativação do cliente" descricao="Envie para o cliente ativar a placa pelo celular." />
            <div className="flex flex-col gap-4 px-5 pb-6 sm:px-6">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 wrap-anywhere rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-800">{ativacao}</code>
                <BotaoCopiar texto={ativacao} rotulo="Link de ativação" />
              </div>
              <a
                href={`https://wa.me/?text=${mensagemWhatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <MessageCircle className="size-4" aria-hidden /> Enviar pelo WhatsApp
              </a>
              {!tag.nfc_entregue_em && tag.status !== "ativa" && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  O link só libera a ativação depois que a entrega for registrada (etapa 3).
                </p>
              )}
            </div>
          </Painel>

          <Painel>
            <TituloPainel titulo="Endereço para gravar no NFC" descricao="Permanente: não muda depois da ativação." />
            <div className="flex flex-col gap-4 px-5 pb-6 sm:px-6">
              {!url.startsWith("https://") && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  Endereço de desenvolvimento. Não grave tags de clientes com este endereço.
                </p>
              )}
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 wrap-anywhere rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-800">{url}</code>
                <BotaoCopiar texto={url} rotulo="Endereço NFC" />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {/* API autenticada que gera o QR sob demanda. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={`QR Code da tag ${tag.codigo}`} width={136} height={136} className="h-auto w-full max-w-[136px] rounded-lg ring-1 ring-slate-200" />
                <a className="text-sm font-medium text-marca-texto hover:underline" href={`${qr}?formato=png&baixar=1`}>
                  Baixar QR Code
                </a>
              </div>
            </div>
          </Painel>
        </div>
      </div>
    </div>
  );
}

export default function TagNfc({ params }: PageProps<"/admin/preparar-nfc/[codigo]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100" />}>
      <Detalhe params={params} />
    </Suspense>
  );
}
