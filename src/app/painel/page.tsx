import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Download, Ellipsis, ExternalLink, Eye, Nfc, Search } from "lucide-react";
import { EstadoVazio, Painel, PilulaStatus } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { formatarData } from "@/lib/placas/rotulos";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { TrocarDestino } from "./trocar-destino";
import { RegistrarPlacaPropria } from "./registrar-placa";
import { urlNfc } from "@/lib/placas/urls";
import { EditarNomeEmpresa } from "@/components/placa/editar-nome-empresa";
import { MenuCliente } from "./menu-cliente";
import { FormPlacaComprada } from "./form-placa-comprada";
import { nomeUsuario } from "@/lib/nome-usuario";

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

export default async function PainelCliente({ searchParams }: PageProps<"/painel">) {
  const supabase = await clienteSupabaseUsuario();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?proximo=/painel");

  const { data: perfil, error: erroPerfil } = await supabase.from("perfis")
    .select("nome, bloqueado_em, limite_placas").eq("id", user.id).maybeSingle();
  if (erroPerfil) throw new Error("Falha ao consultar acesso do cliente");
  if (perfil?.bloqueado_em) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-4 py-12">
        <h1 className="text-xl font-semibold">Acesso ao Speed Tag bloqueado</h1>
        <p className="text-sm text-slate-600">Fale com o suporte para pedir a liberação da sua conta.</p>
        <form action="/auth/sair" method="post">
          <button type="submit" className={buttonVariants({ variant: "outline" })}>Sair</button>
        </form>
      </main>
    );
  }

  const { data: placas, error, count } = await supabase
    .from("placas")
    .select("id, codigo, status, empresa_id, destino_url, ativada_em", { count: "exact" })
    .eq("dono_id", user.id)
    .order("criado_em", { ascending: false });

  const lista = placas ?? [];
  const [leituras, empresas] = await Promise.all([
    leiturasRecentes(supabase, lista.map((p) => p.id)),
    nomesEmpresas(supabase, [...new Set(lista.map((p) => p.empresa_id).filter((v): v is string => !!v))]),
  ]);
  const totalLeituras = [...leituras.values()].reduce((a, b) => a + b, 0);
  const { q, erro, empresa } = await searchParams;
  const empresaFiltrada = typeof empresa === "string" && /^[0-9a-f-]{36}$/i.test(empresa) ? empresa : null;
  const busca = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const termo = busca.toLocaleLowerCase("pt-BR");
  const visiveis = lista.filter(({ codigo, empresa_id }) =>
    (!empresaFiltrada || empresa_id === empresaFiltrada) &&
    (codigo.toLowerCase().includes(termo) ||
      (empresa_id && empresas.get(empresa_id)?.toLocaleLowerCase("pt-BR").includes(termo))),
  );

  return (
    <div className="min-h-dvh bg-slate-50">
      <MenuCliente nome={nomeUsuario(perfil?.nome, user.email)} />

      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-4">
          <h1 id="minhas-placas" className="scroll-mt-20 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">Minhas placas</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {lista.length.toLocaleString("pt-BR")} {lista.length === 1 ? "placa" : "placas"} · {totalLeituras.toLocaleString("pt-BR")} leituras nos últimos {DIAS} dias
          </p>
        </div>

        <p className="mb-4 text-sm text-slate-600">Limite de placas {perfil?.limite_placas ?? "sem limite"} · {count ?? lista.length} vinculadas</p>
        <details id="ativar-placa" open={lista.length === 0 || erro === "codigo" ? true : undefined} className="group mb-4 scroll-mt-20 rounded-2xl bg-marca-fundo text-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            <Nfc className="size-5 text-marca-ciano" aria-hidden /> Ativar placa
            <ChevronDown className="ml-auto size-4 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="flex flex-wrap items-start gap-3 px-4 pb-4">
            <FormPlacaComprada />
            {(perfil?.limite_placas ?? 0) > (count ?? lista.length) && <RegistrarPlacaPropria />}
          </div>
          {erro === "codigo" && <p role="alert" className="px-4 pb-4 text-sm text-red-200">Confira o código público impresso na placa.</p>}
        </details>
        {lista.length > 0 && (
          <form action="/painel" role="search" className="mb-4 flex flex-wrap items-center gap-2">
            {empresaFiltrada && <input type="hidden" name="empresa" value={empresaFiltrada} />}
            <div className="relative min-w-40 flex-1">
              <Search className="absolute top-3 left-3 size-4 text-slate-500" aria-hidden />
              <input type="search" name="q" defaultValue={busca} maxLength={100} aria-label="Buscar por empresa ou código" placeholder="Buscar por empresa ou código" className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm" />
            </div>
            <button type="submit" className={buttonVariants({ variant: "outline", className: "h-10" })}>Buscar</button>
            {(busca || empresaFiltrada) && <Link href="/painel" className="px-2 text-sm font-medium text-marca-texto underline">Limpar</Link>}
          </form>
        )}

        {error ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar suas placas. Recarregue a página.
          </p>
        ) : lista.length === 0 ? (
          <Painel>
            <EstadoVazio icone={Nfc} titulo="Nenhuma placa na sua conta" descricao="Aproxime o celular da placa ou leia o QR Code para ativar. Ela aparece aqui com o mesmo e-mail." />
          </Painel>
        ) : visiveis.length === 0 ? (
          <Painel><EstadoVazio icone={Search} titulo="Nenhuma placa encontrada" descricao={empresaFiltrada ? "Nenhuma placa corresponde ao filtro desta empresa." : "Tente outro código ou nome de empresa."} /></Painel>
        ) : (
          <ul className="flex flex-col gap-3">
            {visiveis.map((p) => (
              <li key={p.id}>
                <Painel className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-semibold tracking-[0.14em] text-slate-900">{p.codigo}</span>
                        <PilulaStatus status={p.status} />
                      </div>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {p.empresa_id && empresas.get(p.empresa_id) ? empresas.get(p.empresa_id) : <span className="text-slate-400">Sem empresa vinculada</span>}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Eye className="size-3.5 shrink-0" aria-hidden />
                        {(leituras.get(p.id) ?? 0).toLocaleString("pt-BR")} leituras em {DIAS} dias
                        {p.ativada_em && ` · ativada em ${formatarData(p.ativada_em)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.status === "ativa" && (
                        <>
                          {p.destino_url && (
                            <a href={p.destino_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ className: "min-h-11 grow sm:min-h-9 sm:grow-0" })}>
                              <ExternalLink aria-hidden /> Abrir avaliação
                            </a>
                          )}
                          <TrocarDestino codigo={p.codigo} />
                        </>
                      )}
                      {(p.status === "atribuida" || p.status === "disponivel") && (
                        <Link href={`/ativar/${p.codigo}`} className={buttonVariants({ className: "min-h-11 w-full sm:min-h-9 sm:w-auto" })}>
                          Ativar placa
                        </Link>
                      )}
                    </div>
                  </div>
                  <details className="mt-3 border-t border-slate-100 pt-2 text-sm">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 font-medium text-marca-texto hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      <Ellipsis className="size-5" aria-hidden /> Mais opções
                    </summary>
                    <div className="mt-2 space-y-3">
                      <p className="break-all text-xs text-slate-500">{urlNfc(p.codigo)}</p>
                      <a href={`/painel/qr/${p.codigo}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        <Download aria-hidden /> Baixar QR Code
                      </a>
                      {p.empresa_id && empresas.has(p.empresa_id) && <EditarNomeEmpresa id={p.empresa_id} nome={empresas.get(p.empresa_id)!} />}
                    </div>
                  </details>
                </Painel>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
