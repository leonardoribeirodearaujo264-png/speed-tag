import Link from "next/link";
import { Nfc } from "lucide-react";
import { redirect } from "next/navigation";
import { FormAtivar } from "@/app/ativar/[codigo]/form-ativar";
import { EmpresaSalva } from "@/app/ativar/[codigo]/empresa-salva";
import { ReivindicarTag } from "@/app/ativar/[codigo]/reivindicar";
import { Painel } from "@/components/admin/ui";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";

export async function PlacaPendente({ codigo, idUsuario, email, empresas }: {
  codigo: string;
  idUsuario: string;
  email: string;
  empresas: { id: string; nome: string; link_avaliacao: string }[];
}) {
  const { data: placa, error } = await clienteSupabaseServico().from("placas")
    .select("status, dono_id, preparada_nfc, nfc_entregue_em").eq("codigo", codigo).maybeSingle();
  if (placa?.status === "ativa" && placa.dono_id === idUsuario) {
    redirect(`/painel/empresas?ativada=${codigo}`);
  }

  const podeVincular = placa?.status === "disponivel" && placa.preparada_nfc && placa.nfc_entregue_em;
  const deveAtivar = placa?.status === "atribuida" && placa.dono_id === idUsuario;
  const empresasSalvas = empresas.filter(({ link_avaliacao }) => linkGooglePermitido(link_avaliacao)).map(({ id, nome }) => ({ id, nome }));
  return (
    <Painel className="mb-5 grid gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Nfc className="size-5 text-marca-texto" aria-hidden /> Ativar placa {codigo}</h2>
        <Link href="/painel/empresas" className="text-sm font-medium text-marca-texto underline">Agora não</Link>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">Não foi possível consultar a placa agora.</p> : podeVincular ? (
        <ReivindicarTag codigo={codigo} />
      ) : deveAtivar ? (
        <div className="max-w-md">
          {empresasSalvas.length > 0 && (
            <EmpresaSalva codigo={codigo} empresas={empresasSalvas} />
          )}
          <FormAtivar codigo={codigo} email={email} />
        </div>
      ) : <p className="text-sm text-slate-600">Esta placa está indisponível para ativação nesta conta. Confira o código da placa.</p>}
    </Painel>
  );
}
