import { Suspense, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { LogoCompleta } from "@/components/marca/marca";
import { FormAtivar } from "./form-ativar";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export const metadata = { title: "Ativar placa", robots: { index: false } };

function Cartao({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:p-8">
      {children}
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/ativar/[codigo]">["params"] }) {
  const codigo = normalizarCodigo((await params).codigo);
  if (!codigoValido(codigo)) notFound();

  const { data: placa, error } = await clienteSupabaseServico().from("placas")
    .select("status, dono_id, preparada_nfc, nfc_entregue_em").eq("codigo", codigo).maybeSingle();
  if (error) throw new Error("Falha ao consultar a placa");
  if (!placa) notFound();
  if (placa.status === "desativada") redirect(`/placa/${codigo}`);

  if (placa.status === "ativa") {
    return (
      <Cartao>
        <p className="text-center text-xl font-semibold tracking-tight text-slate-900">Placa já ativada</p>
        <p className="mt-2 text-center text-sm text-slate-500">Esta placa já leva direto para a avaliação no Google.</p>
        <a href={`/t/${codigo}`} className="mt-6 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-marca to-[#1a8cff] font-semibold text-white shadow-lg shadow-marca/30">
          Abrir avaliação
        </a>
      </Cartao>
    );
  }
  if (placa.status === "reservada") {
    return (
      <Cartao>
        <p className="text-center text-xl font-semibold tracking-tight text-slate-900">Placa reservada</p>
        <p className="mt-2 text-center text-sm text-slate-500">Esta placa ainda não foi liberada. Fale com quem vendeu.</p>
      </Cartao>
    );
  }

  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: liberado } = await supabase.rpc("speed_tag_acesso_cliente");
    if (!liberado) return <Cartao>Seu acesso está indisponível. Fale com o suporte.</Cartao>;
    // Placa já liberada para esta conta: ativa pelo painel, sem e-mail.
    if (placa.dono_id === user.id) redirect(`/painel/empresas?placa=${codigo}`);
  }

  // Visitante do NFC/QR: escolhe a empresa e informa só o e-mail; confirma pelo link.
  return (
    <Cartao>
      <FormAtivar codigo={codigo} emailSugerido={user?.email ?? undefined} />
      <p className="mt-6 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
        Já tem conta?{" "}
        <Link href={`/entrar?proximo=${encodeURIComponent(`/painel/empresas?placa=${codigo}`)}`} className="font-medium text-marca-texto hover:underline">
          Entrar e ativar
        </Link>
      </p>
    </Cartao>
  );
}

export default function AtivarPlaca({ params }: PageProps<"/ativar/[codigo]">) {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center overflow-hidden bg-marca-fundo px-4 pt-10 pb-12 sm:justify-center sm:pt-12">
      {/* Fundo: brilho azul e ciano da marca e linhas de velocidade, como no símbolo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-5%,rgba(23,103,255,0.55),transparent_70%),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(45,212,255,0.18),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div className="relative flex flex-col items-center gap-3">
        <LogoCompleta className="h-12 drop-shadow-[0_8px_24px_rgba(23,103,255,0.35)]" prioridade />
        <p className="text-xs font-medium tracking-[0.2em] text-slate-400 uppercase">Ativação da placa</p>
      </div>
      <div className="relative mt-8 flex w-full justify-center">
        <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-[28px] bg-white/10" />}>
          <Conteudo params={params} />
        </Suspense>
      </div>
      <p className="relative mt-8 text-center text-xs text-slate-500">Placas NFC e QR Code para avaliações no Google</p>
    </main>
  );
}
