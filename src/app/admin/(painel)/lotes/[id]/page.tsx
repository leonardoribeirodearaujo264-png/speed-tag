import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, FileSpreadsheet, FolderArchive, Nfc, Package, Printer, Tags } from "lucide-react";
import { z } from "zod";
import { CabecalhoPagina, CartaoIndicador, Painel, TituloPainel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { formatarData } from "@/lib/placas/rotulos";
import type { StatusPlaca } from "@/lib/supabase/tipos";
import { FormAtribuirLote } from "./form-atribuir";
import { FormModeloLote } from "./form-modelo";
import { ExcluirLote } from "./excluir-lote";
import { FILTRO_PLACAS_EM_USO } from "@/lib/placas/exclusao-lote";
import { modeloArte } from "@/lib/placas/modelos-arte";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


type Supabase = Awaited<ReturnType<typeof exigirAdmin>>["supabase"];

async function contar(supabase: Supabase, loteId: string, filtro: StatusPlaca | "todas" | "nfc" | "em_uso"): Promise<number> {
  let consulta = supabase.from("placas").select("id", { count: "exact", head: true }).eq("lote_id", loteId);
  if (filtro === "nfc") consulta = consulta.not("nfc_gravado_em", "is", null);
  else if (filtro === "em_uso") consulta = consulta.or(FILTRO_PLACAS_EM_USO);
  else if (filtro !== "todas") consulta = consulta.eq("status", filtro);
  const { count } = await consulta;
  return count ?? 0;
}

export default async function DetalheLote({ params, searchParams }: PageProps<"/admin/lotes/[id]">) {
  const { id } = await params;
  const { supabase } = await exigirAdmin(`/admin/lotes/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const { data: lote, error } = await supabase
    .from("lotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Falha ao carregar o lote");
  if (!lote) notFound();

  const [total, disponiveis, atribuidas, ativas, comNfc, emUso] = await Promise.all([
    contar(supabase, id, "todas"),
    contar(supabase, id, "disponivel"),
    contar(supabase, id, "atribuida"),
    contar(supabase, id, "ativa"),
    contar(supabase, id, "nfc"),
    contar(supabase, id, "em_uso"),
  ]);
  const { criado } = await searchParams;
  const exportar = `/api/admin/lotes/${id}/exportar`;

  return (
    <div>
      <Link href="/admin/lotes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Lotes
      </Link>

      {criado === "1" && (
        <div role="status" className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden />
          Lote criado com {total.toLocaleString("pt-BR")} placas.
        </div>
      )}

      <CabecalhoPagina
        sobretitulo="Lote"
        titulo={lote.nome}
        descricao={`Criado em ${formatarData(lote.criado_em)}${lote.revendedor ? ` · Revendedor: ${lote.revendedor}` : ""}`}
        acoes={
          <>
            <Link href={`/admin/placas?lote=${id}`} className={buttonVariants({ variant: "outline", className: "min-h-11 px-4 sm:min-h-9" })}>
              <Tags aria-hidden /> Ver placas
            </Link>
            <ExcluirLote loteId={id} nome={lote.nome} total={total} emUso={emUso} nfcGravado={comNfc} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoIndicador rotulo="Em estoque" valor={disponiveis} icone={Package} tom="cinza" detalhe={`de ${total} placas`} />
        <CartaoIndicador rotulo="Aguardando ativação" valor={atribuidas} icone={Clock} tom="ambar" />
        <CartaoIndicador rotulo="Ativas" valor={ativas} icone={CheckCircle2} tom="verde" />
        <CartaoIndicador rotulo="NFC gravado" valor={comNfc} icone={Nfc} detalhe={`${total - comNfc} pendentes`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Painel>
          <TituloPainel titulo="Atribuir a um cliente" descricao="Passa placas em estoque deste lote para a conta do cliente." />
          <div className="px-5 pb-6 sm:px-6">
            <FormAtribuirLote loteId={id} disponiveis={disponiveis} />
          </div>
        </Painel>

        <Painel>
          <TituloPainel titulo="Arte das placas" descricao="Modelo usado na prévia, no PNG e na folha de impressão deste lote." />
          <div className="px-5 pb-6 sm:px-6">
            <FormModeloLote loteId={id} atual={modeloArte(lote.modelo_arte)} />
          </div>
        </Painel>

        <Painel>
          <TituloPainel titulo="Exportar para a gráfica" descricao="Planilha com os links, QR Codes e folha de impressão." />
          <div className="flex flex-wrap gap-2 px-5 pb-6 sm:px-6">
            <a href={`${exportar}?formato=csv`} className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet aria-hidden /> Planilha CSV
            </a>
            <a href={`${exportar}?formato=zip`} className={buttonVariants({ variant: "outline" })}>
              <FolderArchive aria-hidden /> QR Codes (ZIP)
            </a>
            <Link href={`/admin/impressao?lote=${id}&modelo=${modeloArte(lote.modelo_arte)}`} className={buttonVariants({ variant: "outline" })}>
              <Printer aria-hidden /> Folha de impressão / PDF
            </Link>
          </div>
        </Painel>
      </div>
    </div>
  );
}
