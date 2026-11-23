import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Nfc, Star } from "lucide-react";
import { EstadoVazio, Painel, PilulaStatus } from "@/components/admin/ui";
import { LogoCompleta } from "@/components/marca/marca";
import { buttonVariants } from "@/components/ui/button";
import { formatarData } from "@/lib/placas/rotulos";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { TrocarDestino } from "./trocar-destino";

// Área com login: a navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Minhas placas" };

const DIAS = 30;

type Supabase = Awaited<ReturnType<typeof clienteSupabaseUsuario>>;

/** Leituras dos últimos dias por placa (o RLS só devolve as placas do próprio cliente). */
async function leiturasRecentes(supabase: Supabase, ids: string[]) {
  const contagem = new Map<string, number>();
  if (!ids.length) return contagem;
  const desde = new Date(Date.now() - DIAS * 86_400_000).toISOString();
  const { data } = await supabase.from("leituras").select("placa_id").in("placa_id", ids).gte("ocorrida_em", desde).limit(20_000);
  for (const l of data ?? []) contagem.set(l.placa_id, (contagem.get(l.placa_id) ?? 0) + 1);
  return contagem;
}

async function nomesEmpresas(supabase: Supabase, ids: string[]) {
  const nomes = new Map<string, string>();
  if (!ids.length) return nomes;
  const { data } = await supabase.from("empresas").select("id, nome").in("id", ids);
  for (const e of data ?? []) nomes.set(e.id, e.nome);
  return nomes;
}

export default async function PainelCliente() {
  const supabase = await clienteSupabaseUsuario();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?proximo=/painel");

  const { data: placas, error } = await supabase
    .from("placas")
    .select("id, codigo, status, empresa_id, destino_url, ativada_em")
    .eq("dono_id", user.id)
    .order("criado_em", { ascending: false });

  const lista = placas ?? [];
  const [leituras, empresas] = await Promise.all([
    leiturasRecentes(supabase, lista.map((p) => p.id)),
    nomesEmpresas(supabase, [...new Set(lista.map((p) => p.empresa_id).filter((v): v is string => !!v))]),
  ]);
  const totalLeituras = [...leituras.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-marca-fundo">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <LogoCompleta className="h-9" />
          <form action="/auth/sair" method="post">
            <input type="hidden" name="destino" value="/entrar" />
            <button type="submit" className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="truncate text-sm font-medium text-marca-texto">{user.email}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">Minhas placas</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {lista.length.toLocaleString("pt-BR")} {lista.length === 1 ? "placa" : "placas"} · {totalLeituras.toLocaleString("pt-BR")} leituras nos últimos {DIAS} dias
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar suas placas. Recarregue a página.
          </p>
        ) : lista.length === 0 ? (
          <Painel>
            <EstadoVazio icone={Nfc} titulo="Nenhuma placa na sua conta" descricao="Aproxime o celular da placa ou leia o QR Code para ativar. Ela aparece aqui com o mesmo e-mail." />
          </Painel>
        ) : (
          <ul className="flex flex-col gap-3">
            {lista.map((p) => (
              <li key={p.id}>
                <Painel className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-semibold tracking-[0.14em] text-slate-900">{p.codigo}</span>
                        <PilulaStatus status={p.status} />
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-600">
                        {p.empresa_id && empresas.get(p.empresa_id) ? empresas.get(p.empresa_id) : <span className="text-slate-400">Sem empresa vinculada</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {(leituras.get(p.id) ?? 0).toLocaleString("pt-BR")} leituras em {DIAS} dias
                        {p.ativada_em && ` · ativada em ${formatarData(p.ativada_em)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.status === "ativa" && (
                        <>
                          {p.destino_url && (
                            <a href={p.destino_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                              <Star /> Testar avaliação <ExternalLink className="size-3" />
                            </a>
                          )}
                          <TrocarDestino codigo={p.codigo} />
                        </>
                      )}
                      {(p.status === "atribuida" || p.status === "disponivel") && (
                        <Link href={`/ativar/${p.codigo}`} className={buttonVariants({ size: "sm" })}>
                          Ativar placa
                        </Link>
                      )}
                    </div>
                  </div>
                </Painel>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
