import { Suspense, type ComponentType } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Ban, CircleHelp, Clock, PackageOpen, Star } from "lucide-react";
import { LogoCompleta } from "@/components/marca/marca";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";
import type { StatusPlaca } from "@/lib/supabase/tipos";

export const metadata = { title: "Placa", robots: { index: false } };

type Situacao = StatusPlaca | "inexistente";

const CONTEUDO: Record<
  Situacao,
  { icone: ComponentType<{ className?: string }>; titulo: string; texto: string; tom: string }
> = {
  inexistente: {
    icone: CircleHelp,
    titulo: "Placa não encontrada",
    texto: "Não existe placa com este código. Confira o código impresso abaixo do QR Code.",
    tom: "from-slate-400 to-slate-600",
  },
  disponivel: {
    icone: PackageOpen,
    titulo: "Placa ainda não liberada",
    texto: "Esta placa ainda está no estoque da Speed Tag. Se você comprou, peça a liberação a quem vendeu.",
    tom: "from-slate-400 to-slate-600",
  },
  reservada: {
    icone: PackageOpen,
    titulo: "Placa ainda não liberada",
    texto: "Esta placa está separada para um cliente e ainda não foi entregue na conta dele.",
    tom: "from-violet-400 to-violet-600",
  },
  atribuida: {
    icone: Clock,
    titulo: "Placa ainda não ativada",
    texto: "O dono desta placa ainda não escolheu a empresa. Se a placa é sua, entre no seu painel para ativar.",
    tom: "from-amber-400 to-amber-600",
  },
  ativa: {
    icone: Star,
    titulo: "Sua opinião é muito importante",
    texto: "Toque no botão abaixo para avaliar no Google.",
    tom: "from-marca-ciano to-marca",
  },
  desativada: {
    icone: Ban,
    titulo: "Placa desativada",
    texto: "Esta placa não está mais em uso. Se você é o dono, fale com o suporte da Speed Tag.",
    tom: "from-red-400 to-red-600",
  },
};

async function situacaoDa(codigo: string): Promise<Situacao> {
  if (!codigoValido(codigo)) return "inexistente";
  const { data, error } = await clienteSupabaseServico().from("placas")
    .select("status, preparada_nfc").eq("codigo", codigo).maybeSingle();
  if (error) throw new Error("Falha ao consultar a placa");
  // Placa criada (em estoque) ou atribuída vai para a ativação.
  if (data?.status === "disponivel" || data?.status === "atribuida") {
    redirect(`/ativar/${codigo}`);
  }
  return data?.status ?? "inexistente";
}

async function Cartao({ params }: { params: PageProps<"/placa/[codigo]">["params"] }) {
  const { codigo: bruto } = await params;
  const codigo = normalizarCodigo(bruto);
  const situacao = await situacaoDa(codigo);
  const { icone: Icone, titulo, texto, tom } = CONTEUDO[situacao];

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95">
      <span className={`mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br ${tom} text-white shadow-lg`}>
        <Icone className="size-8" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{texto}</p>

      {situacao === "ativa" && (
        <a
          href={`/t/${codigo}`}
          className="mt-6 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-marca to-[#1a8cff] font-semibold text-white shadow-lg shadow-marca/30"
        >
          Avaliar no Google
        </a>
      )}
      {situacao === "atribuida" && (
        <Link
          href="/entrar?proximo=/painel"
          className="mt-6 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-marca to-[#1a8cff] font-semibold text-white shadow-lg shadow-marca/30"
        >
          Sou o dono, entrar
        </Link>
      )}

      {situacao !== "inexistente" && (
        <p className="mt-6 font-mono text-xs tracking-[0.3em] text-slate-400">{codigo}</p>
      )}
    </div>
  );
}

export default function PaginaPlaca({ params }: PageProps<"/placa/[codigo]">) {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center gap-10 overflow-hidden bg-marca-fundo px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(23,103,255,0.35),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(45,212,255,0.15),transparent_55%)]"
      />
      <LogoCompleta className="relative h-12" prioridade />
      <div className="relative flex w-full justify-center">
        <Suspense fallback={<div className="h-80 w-full max-w-sm animate-pulse rounded-3xl bg-white/10" />}>
          <Cartao params={params} />
        </Suspense>
      </div>
      <p className="relative text-xs text-slate-500">Placas NFC e QR Code para avaliações no Google</p>
    </main>
  );
}
