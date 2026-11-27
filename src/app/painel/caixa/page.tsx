import Link from "next/link";
import { redirect } from "next/navigation";
import { CANAIS, PAGAMENTOS, PERIODOS, STATUS_VENDA, formatarMoeda, inicioDoPeriodo, modelosRecentes, montarResumo, periodoValido } from "@/lib/caixa/regras";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { PaginaCliente } from "../menu-cliente";
import { ExcluirLancamento } from "./excluir-lancamento";
import { LancarVenda, RegistrarCompra } from "./formularios";

export const instant = false;
export const metadata = { title: "Caixa" };

/** Lista mostra as últimas do período; os cartões somam o período inteiro no banco. */
const LIMITE_LISTA = 50;
/** Últimos lançamentos de onde saem os atalhos "Usados antes" (de qualquer período). */
const BASE_ATALHOS = 30;
const COMPRAS_NA_TELA = 5;
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

function Cartao({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe: string; destaque?: "lucro" | "negativo" }) {
  const cor = destaque === "lucro" ? "text-emerald-300" : destaque === "negativo" ? "text-red-300" : "text-white";
  return (
    <div className="min-w-0 rounded-2xl border border-slate-700 bg-slate-900 p-3.5 sm:p-5">
      <p className="text-xs text-slate-400 sm:text-sm">{rotulo}</p>
      <p className={`mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl ${cor}`}>{valor}</p>
      <p className="mt-0.5 truncate text-xs text-slate-400">{detalhe}</p>
    </div>
  );
}

export default async function Caixa({ searchParams }: PageProps<"/painel/caixa">) {
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?proximo=/painel/caixa");

  const periodo = periodoValido((await searchParams).periodo);
  const inicio = inicioDoPeriodo(periodo);
  let consultaVendas = supabase.from("caixa_vendas").select("id, quantidade, valor_unitario, canal, pagamento, status, vendida_em")
    .eq("dono_id", user.id).order("vendida_em", { ascending: false }).limit(LIMITE_LISTA);
  if (inicio) consultaVendas = consultaVendas.gte("vendida_em", inicio);

  const [acesso, resumoBanco, vendas, compras, recentes] = await Promise.all([
    supabase.rpc("speed_tag_acesso_cliente"),
    supabase.rpc("speed_tag_resumo_caixa", { p_inicio: inicio }),
    consultaVendas,
    supabase.from("caixa_compras").select("id, quantidade, custo_unitario, comprada_em").eq("dono_id", user.id)
      .order("comprada_em", { ascending: false }).limit(BASE_ATALHOS),
    supabase.from("caixa_vendas").select("quantidade, valor_unitario, custo_unitario, canal, pagamento, status").eq("dono_id", user.id)
      .order("vendida_em", { ascending: false }).limit(BASE_ATALHOS),
  ]);
  if (acesso.error || !acesso.data) return <PaginaCliente><p role="alert">Seu acesso está indisponível.</p></PaginaCliente>;
  if (resumoBanco.error || vendas.error || compras.error || recentes.error) {
    console.error("[caixa]", resumoBanco.error?.code, vendas.error?.code, compras.error?.code, recentes.error?.code);
    return <PaginaCliente><p role="alert" className="rounded-xl border border-red-900 bg-red-950 p-4 text-red-200">Não foi possível carregar o caixa. Atualize a página.</p></PaginaCliente>;
  }
  const r = montarResumo(resumoBanco.data[0]);
  const modelosVenda = modelosRecentes(recentes.data, ["quantidade", "valor_unitario", "custo_unitario", "canal", "pagamento", "status"]);
  const modelosCompra = modelosRecentes(compras.data, ["quantidade", "custo_unitario"]);
  const ultimasCompras = compras.data.slice(0, COMPRAS_NA_TELA);

  return (
    <PaginaCliente>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Caixa</h1>

      <nav aria-label="Período" className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-slate-900 p-1">
        {(Object.keys(PERIODOS) as (keyof typeof PERIODOS)[]).map((p) => (
          <Link key={p} href={p === "hoje" ? "/painel/caixa" : `/painel/caixa?periodo=${p}`} aria-current={p === periodo ? "page" : undefined}
            className={`grid min-h-11 place-items-center rounded-xl px-1 text-center text-sm font-medium focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              p === periodo ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"
            }`}>
            {PERIODOS[p]}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3">
        <Cartao rotulo="Faturamento" valor={formatarMoeda(r.faturamento)}
          detalhe={`${r.vendas} ${r.vendas === 1 ? "venda" : "vendas"}${r.pendente > 0 ? ` · ${formatarMoeda(r.pendente)} pendente` : ""}`} />
        <Cartao rotulo="Lucro estimado" valor={formatarMoeda(r.lucro)} detalhe={`custos ${formatarMoeda(r.custos)}`} destaque={r.lucro < 0 ? "negativo" : "lucro"} />
        <Cartao rotulo="Placas vendidas" valor={r.unidades.toLocaleString("pt-BR")} detalhe="unidades" />
        <Cartao rotulo="Estoque" valor={r.estoque.toLocaleString("pt-BR")} detalhe={r.estoque < 0 ? "registre as compras" : "disponíveis"} destaque={r.estoque < 0 ? "negativo" : undefined} />
      </div>

      <div className="my-4">
        <LancarVenda custoMedio={r.custoMedio} modelos={modelosVenda} />
      </div>

      <section aria-labelledby="titulo-vendas" className="rounded-2xl border border-slate-700 bg-slate-900 p-3.5 sm:p-5">
        <h2 id="titulo-vendas" className="text-lg font-semibold">Vendas</h2>
        {!vendas.data.length ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma venda no período.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-800">
            {vendas.data.map((v) => {
              const total = Math.round(v.quantidade * v.valor_unitario * 100) / 100;
              return (
                <li key={v.id} className="flex min-w-0 items-center gap-3 py-2.5">
                  <span className="w-11 shrink-0 text-xs tabular-nums text-slate-400">{dataCurta.format(new Date(v.vendida_em))}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{CANAIS[v.canal]} · {PAGAMENTOS[v.pagamento]}</p>
                    <p className="truncate text-xs text-slate-400">
                      {v.quantidade} {v.quantidade === 1 ? "placa" : "placas"} ·{" "}
                      <span className={v.status === "pendente" ? "text-amber-300" : undefined}>{STATUS_VENDA[v.status]}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatarMoeda(total)}</span>
                  <ExcluirLancamento tipo="venda" id={v.id} descricao={`de ${formatarMoeda(total)} (${dataCurta.format(new Date(v.vendida_em))})`} />
                </li>
              );
            })}
          </ul>
        )}
        {vendas.data.length === LIMITE_LISTA && <p className="mt-2 text-xs text-slate-400">Mostrando as {LIMITE_LISTA} vendas mais recentes do período.</p>}
      </section>

      <section aria-labelledby="titulo-estoque" className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="titulo-estoque" className="text-lg font-semibold">Estoque: {r.estoque.toLocaleString("pt-BR")} {Math.abs(r.estoque) === 1 ? "placa" : "placas"}</h2>
            <p className="text-sm text-slate-400">{r.custoMedio > 0 ? `custo médio ${formatarMoeda(r.custoMedio)} por placa` : "registre uma compra para calcular o custo médio"}</p>
          </div>
          <RegistrarCompra modelos={modelosCompra} />
        </div>
        {ultimasCompras.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-800 border-t border-slate-800">
            {ultimasCompras.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-3 py-2.5">
                <span className="w-11 shrink-0 text-xs tabular-nums text-slate-400">{dataCurta.format(new Date(c.comprada_em))}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">+{c.quantidade.toLocaleString("pt-BR")} {c.quantidade === 1 ? "placa" : "placas"}</p>
                  <p className="truncate text-xs text-slate-400">{formatarMoeda(c.custo_unitario)} cada</p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-slate-300">{formatarMoeda(Math.round(c.quantidade * c.custo_unitario * 100) / 100)}</span>
                <ExcluirLancamento tipo="compra" id={c.id} descricao={`de ${c.quantidade} placas (${dataCurta.format(new Date(c.comprada_em))})`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PaginaCliente>
  );
}
