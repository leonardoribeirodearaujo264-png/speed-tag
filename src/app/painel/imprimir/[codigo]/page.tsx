import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buscarPlacaPorCodigo } from "@/lib/placas/consultas";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { ArteParaImpressao } from "./arte-para-impressao";

export const instant = false;
export const metadata = { title: "Imprimir placa" };

export default async function ImprimirPlaca({ params }: PageProps<"/painel/imprimir/[codigo]">) {
  const { codigo } = await params;
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?proximo=${encodeURIComponent(`/painel/imprimir/${codigo}`)}`);
  const busca = await buscarPlacaPorCodigo(supabase, codigo);
  if (!busca.ok) {
    if (busca.status === 500) throw new Error("Não foi possível consultar a placa");
    notFound();
  }
  const placa = busca.dado;
  if (placa.dono_id !== user.id) notFound();

  const voltar = placa.empresa_id ? `/painel/empresas/${placa.empresa_id}` : "/painel";
  return (
    <main className="pt-seguro pb-seguro mx-auto w-full max-w-xl space-y-4 px-4 sm:py-8 print:max-w-none print:p-0">
      <div className="space-y-2 pt-4 sm:pt-0 print:hidden">
        <Link href={voltar} className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm font-medium text-marca-texto underline sm:min-h-0">Voltar à gestão da placa</Link>
        <h1 className="break-words text-xl font-semibold text-slate-900">Imprimir placa {placa.codigo}</h1>
      </div>
      <ArteParaImpressao codigo={placa.codigo} />
    </main>
  );
}
