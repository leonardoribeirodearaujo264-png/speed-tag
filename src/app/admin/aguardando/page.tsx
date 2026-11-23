import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, RefreshCw, ShieldX } from "lucide-react";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { Skeleton } from "@/components/ui/skeleton";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

// Página com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Aguardando aprovação" };

function BotaoSair() {
  return (
    <form action="/auth/sair" method="post">
      <input type="hidden" name="destino" value="/admin/entrar" />
      <button type="submit" className="text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline">
        Sair e entrar com outra conta
      </button>
    </form>
  );
}

async function Situacao() {
  const supabase = await clienteSupabaseUsuario();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/entrar");

  const { data: status, error } = await supabase.rpc("solicitar_admin");
  if (error) throw new Error("Falha ao registrar o pedido de acesso");
  if (status === "ADMIN") redirect("/admin/placas");

  if (status === "RECUSADO") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50/60 p-5">
          <ShieldX className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
          <p className="text-sm leading-relaxed text-red-800">
            O pedido de acesso de <span className="font-medium">{user.email}</span> foi recusado. Se foi engano, fale com um
            administrador.
          </p>
        </div>
        <BotaoSair />
      </div>
    );
  }

  const etapas = [
    { feito: true, texto: "Conta criada e e-mail confirmado" },
    { feito: true, texto: "Pedido de acesso enviado" },
    { feito: false, texto: "Aprovação de um administrador" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
        {etapas.map(({ feito, texto }) => (
          <li key={texto} className="flex items-center gap-3 text-sm">
            {feito ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <Clock className="size-5 shrink-0 animate-pulse text-amber-500" aria-hidden />
            )}
            <span className={feito ? "text-slate-600" : "font-medium text-slate-900"}>{texto}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm leading-relaxed text-slate-500">
        Logado como <span className="font-medium text-slate-700">{user.email}</span>. Assim que o acesso for aprovado, é só
        atualizar esta página.
      </p>
      <a
        href="/admin/aguardando"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        <RefreshCw className="size-4" aria-hidden />
        Verificar aprovação
      </a>
      <div className="text-center">
        <BotaoSair />
      </div>
    </div>
  );
}

export default function Aguardando() {
  return (
    <LayoutAutenticacao
      selo="Área administrativa"
      titulo="Acesso em análise"
      subtitulo="Sua conta está pronta. Falta um administrador liberar o acesso ao painel."
    >
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <Situacao />
      </Suspense>
    </LayoutAutenticacao>
  );
}
