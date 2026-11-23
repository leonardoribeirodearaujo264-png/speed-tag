import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { FormAtivar } from "./form-ativar";

// Página com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Ativar placa", robots: { index: false } };

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-sm leading-relaxed text-slate-600">{children}</p>;
}

async function Conteudo({ params }: { params: PageProps<"/ativar/[codigo]">["params"] }) {
  const codigo = normalizarCodigo((await params).codigo);
  if (!codigoValido(codigo)) notFound();

  const { data: placa, error } = await clienteSupabaseServico()
    .from("placas")
    .select("status, dono_id, preparada_nfc, nfc_entregue_em")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error("Falha ao consultar a placa");
  if (!placa) notFound();
  if (placa.status === "desativada") redirect(`/placa/${codigo}`);

  if (placa.status === "ativa") {
    return (
      <div className="flex flex-col gap-4">
        <Aviso>Esta placa já está ativa e leva direto para a avaliação no Google.</Aviso>
        <a href={`/t/${codigo}`} className="flex h-12 items-center justify-center rounded-xl bg-blue-600 font-semibold text-white">
          Abrir avaliação
        </a>
      </div>
    );
  }
  if (placa.status === "reservada" || (placa.preparada_nfc && !placa.nfc_entregue_em && !placa.dono_id)) {
    return <Aviso>A placa <strong>{codigo}</strong> ainda não foi liberada. Fale com quem vendeu a placa.</Aviso>;
  }

  const supabase = await clienteSupabaseUsuario();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && placa.dono_id && placa.dono_id !== user.id) {
    return (
      <div className="flex flex-col gap-4">
        <Aviso>Esta placa pertence a outra conta. Entre com o e-mail do dono da placa.</Aviso>
        <form action="/auth/sair" method="post">
          <input type="hidden" name="destino" value={`/ativar/${codigo}`} />
          <button type="submit" className="text-sm font-medium text-blue-700 hover:underline">Sair e trocar de conta</button>
        </form>
      </div>
    );
  }

  return <FormAtivar codigo={codigo} logado={!!user} />;
}

export default function AtivarPlaca({ params }: PageProps<"/ativar/[codigo]">) {
  return (
    <LayoutAutenticacao titulo="Ative sua placa" subtitulo="Em poucos passos, sua placa passa a levar seus clientes direto para a avaliação no Google.">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100" />}>
        <Conteudo params={params} />
      </Suspense>
    </LayoutAutenticacao>
  );
}
