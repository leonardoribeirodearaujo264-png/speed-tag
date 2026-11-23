import { Suspense } from "react";
import Link from "next/link";
import { CabecalhoPagina, Painel } from "@/components/admin/ui";
import { exigirAdmin } from "@/lib/auth";
import { marcosNfc, ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";
import { NovaTagNfc } from "./nova-tag";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


const POR_PAGINA = 25;

async function Tags({ searchParams }: { searchParams: Promise<{ pagina?: string | string[] }> }) {
  const [{ supabase }, parametros] = await Promise.all([exigirAdmin(ROTA_PREPARO_NFC), searchParams]);
  const solicitada = Number(parametros.pagina);
  const pagina = Number.isSafeInteger(solicitada) && solicitada > 0 && solicitada <= 1_000_000 ? solicitada : 1;
  const inicio = (pagina - 1) * POR_PAGINA;
  const { data, error } = await supabase.from("placas")
    .select("codigo, status, criado_em, nfc_gravado_em, nfc_testada_em, nfc_entregue_em, ativada_em")
    .eq("preparada_nfc", true)
    .order("criado_em", { ascending: false })
    .order("codigo", { ascending: false })
    .range(inicio, inicio + POR_PAGINA);

  if (error) {
    console.error("[preparar-nfc] listagem", error.code);
    return <p role="alert">Não foi possível consultar as tags NFC.</p>;
  }

  return (
    <Painel className="divide-y divide-slate-100">
      {data.length === 0 && <p className="p-5 text-sm text-muted-foreground">Nenhuma tag nesta página.</p>}
      {data.slice(0, POR_PAGINA).map((tag) => (
        <Link key={tag.codigo} href={`${ROTA_PREPARO_NFC}/${tag.codigo}`}
          className="flex items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-slate-50">
          <span className="font-semibold text-marca-texto">{tag.codigo}</span>
          <span>{tag.status === "desativada" ? "Desativada" : marcosNfc(tag).filter(({ data }) => data).at(-1)?.rotulo}</span>
        </Link>
      ))}
      {(pagina > 1 || data.length > POR_PAGINA) && (
        <nav aria-label="Paginação das tags" className="flex gap-5 p-5 text-sm text-marca-texto">
          {pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}
          {data.length > POR_PAGINA && <Link href={`?pagina=${pagina + 1}`}>Próxima</Link>}
        </nav>
      )}
    </Painel>
  );
}

export default function PrepararNfc({ searchParams }: PageProps<"/admin/preparar-nfc">) {
  return (
    <>
      <CabecalhoPagina titulo="Preparar NFC" descricao="Cadastre, grave, teste e entregue tags virgens." acoes={<NovaTagNfc />} />
      <Suspense fallback={<p>Carregando tags...</p>}><Tags searchParams={searchParams} /></Suspense>
    </>
  );
}
