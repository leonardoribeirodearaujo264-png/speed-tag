import Link from "next/link";
import {
  CANAIS, PAGAMENTOS, PERIODOS, STATUS_VENDA, formatarMoeda, inicioDoPeriodo, modelosRecentes, montarResumo, type Periodo,
} from "@/lib/caixa/regras";
import type { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { ExcluirLancamento } from "./excluir-lancamento";
import { EditarCompra, EditarVenda, LancarVenda, RegistrarCompra } from "./formularios";
import { ESTILOS_CAIXA, type TemaCaixa } from "./tema";

type Supabase = Awaited<ReturnType<typeof clienteSupabaseUsuario>>;

/** Lista mostra as últimas do período; os cartões somam o período inteiro no banco. */
const LIMITE_LISTA = 50;
/** Últimos lançamentos de onde saem os atalhos "Usados antes" (de qualquer período). */
const BASE_ATALHOS = 30;
const COMPRAS_NA_TELA = 5;
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const plural = (n: number) => `${n.toLocaleString("pt-BR")} ${Math.abs(n) === 1 ? "placa" : "placas"}`;

/** Lê o caixa da conta logada (as políticas do banco limitam ao dono). */
export async function carregarCaixa(supabase: Supabase, donoId: string, periodo: Periodo) {
  const inicio = inicioDoPeriodo(periodo);
  let consultaVendas = supabase.from("caixa_vendas").select("id, quantidade, valor_unitario, custo_unitario, canal, pagamento, status, vendida_em")
    .eq("dono_id", donoId).order("vendida_em", { ascending: false }).limit(LIMITE_LISTA);
  if (inicio) consultaVendas = consultaVendas.gte("vendida_em", inicio);

  const [resumo, vendas, compras, recentes] = await Promise.all([
    supabase.rpc("speed_tag_resumo_caixa", { p_inicio: inicio }),
    consultaVendas,
    supabase.from("caixa_compras").select("id, quantidade, custo_unitario, comprada_em").eq("dono_id", donoId)
      .order("comprada_em", { ascending: false }).limit(BASE_ATALHOS),
    supabase.from("caixa_vendas").select("quantidade, valor_unitario, custo_unitario, canal, pagamento, status").eq("dono_id", donoId)
      .order("vendida_em", { ascending: false }).limit(BASE_ATALHOS),
  ]);
  if (resumo.error || vendas.error || compras.error || recentes.error) {
    console.error("[caixa]", resumo.error?.code, vendas.error?.code, compras.error?.code, recentes.error?.code);
    return null;
  }
  return {
    resumo: montarResumo(resumo.data[0]),
    vendas: vendas.data,
    compras: compras.data.slice(0, COMPRAS_NA_TELA),
    modelosVenda: modelosRecentes(recentes.data, ["quantidade", "valor_unitario", "custo_unitario", "canal", "pagamento", "status"]),
    modelosCompra: modelosRecentes(compras.data, ["quantidade", "custo_unitario"]),
  };
}

type DadosCaixa = NonNullable<Awaited<ReturnType<typeof carregarCaixa>>>;

function Cartao({ rotulo, valor, detalhe, cor, tema }: { rotulo: string; valor: string; detalhe: string; cor?: string; tema: TemaCaixa }) {
  const e = ESTILOS_CAIXA[tema];
  return (
    <div className={`min-w-0 p-3.5 sm:p-5 ${e.cartao}`}>
      <p className={`text-xs sm:text-sm ${e.suave}`}>{rotulo}</p>
      <p className={`mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl ${cor ?? e.texto}`}>{valor}</p>
      <p className={`mt-0.5 truncate text-xs ${e.suave}`}>{detalhe}</p>
    </div>
  );
}

export function ErroCaixa({ tema }: { tema: TemaCaixa }) {
  return <p role="alert" className={`rounded-xl border p-4 ${ESTILOS_CAIXA[tema].erro}`}>Não foi possível carregar o caixa. Atualize a página.</p>;
}

/** Período, cartões, lançar venda, vendas e estoque: igual no painel do cliente e no do ADM. */
export function TelaCaixa({ dados, periodo, caminho, tema }: { dados: DadosCaixa; periodo: Periodo; caminho: string; tema: TemaCaixa }) {
  const e = ESTILOS_CAIXA[tema];
  const r = dados.resumo;
  return (
    <div className={e.texto}>
      <nav aria-label="Período" className={`mb-4 grid grid-cols-4 gap-1 rounded-2xl p-1 ${e.periodo}`}>
        {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
          <Link key={p} href={p === "hoje" ? caminho : `${caminho}?periodo=${p}`} aria-current={p === periodo ? "page" : undefined}
            className={`grid min-h-11 place-items-center rounded-xl px-1 text-center text-sm font-medium focus-visible:ring-2 ${e.foco} ${p === periodo ? e.periodoAtivo : e.periodoInativo}`}>
            {PERIODOS[p]}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao tema={tema} rotulo="Faturamento" valor={formatarMoeda(r.faturamento)}
          detalhe={`${r.vendas} ${r.vendas === 1 ? "venda" : "vendas"}${r.pendente > 0 ? ` · ${formatarMoeda(r.pendente)} pendente` : ""}`} />
        <Cartao tema={tema} rotulo="Lucro estimado" valor={formatarMoeda(r.lucro)} detalhe={`custos ${formatarMoeda(r.custos)}`} cor={r.lucro < 0 ? e.negativo : e.lucro} />
        <Cartao tema={tema} rotulo="Placas vendidas" valor={r.unidades.toLocaleString("pt-BR")} detalhe="unidades" />
        <Cartao tema={tema} rotulo="Estoque" valor={r.estoque.toLocaleString("pt-BR")} detalhe={r.estoque < 0 ? "registre as compras" : "disponíveis"} cor={r.estoque < 0 ? e.negativo : undefined} />
      </div>

      <div className="my-4">
        <LancarVenda custoMedio={r.custoMedio} modelos={dados.modelosVenda} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <section aria-labelledby="titulo-vendas" className={`p-3.5 sm:p-5 ${e.cartao}`}>
          <h2 id="titulo-vendas" className="text-lg font-semibold">Vendas</h2>
          {!dados.vendas.length ? (
            <p className={`mt-2 text-sm ${e.suave}`}>Nenhuma venda no período.</p>
          ) : (
            <ul className={`mt-2 divide-y ${e.divisor}`}>
              {dados.vendas.map((v) => {
                const total = Math.round(v.quantidade * v.valor_unitario * 100) / 100;
                const data = dataCurta.format(new Date(v.vendida_em));
                return (
                  <li key={v.id} className="flex min-w-0 items-center gap-3 py-2.5">
                    <span className={`w-11 shrink-0 text-xs tabular-nums ${e.suave}`}>{data}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{CANAIS[v.canal]} · {PAGAMENTOS[v.pagamento]}</p>
                      <p className={`truncate text-xs ${e.suave}`}>
                        {plural(v.quantidade)} · <span className={v.status === "pendente" ? e.pendente : undefined}>{STATUS_VENDA[v.status]}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatarMoeda(total)}</span>
                    <div className="-mr-2 flex shrink-0">
                      <EditarVenda tema={tema} venda={v} descricao={`de ${formatarMoeda(total)} (${data})`} />
                      <ExcluirLancamento tema={tema} tipo="venda" id={v.id} descricao={`de ${formatarMoeda(total)} (${data})`} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {dados.vendas.length === LIMITE_LISTA && <p className={`mt-2 text-xs ${e.suave}`}>Mostrando as {LIMITE_LISTA} vendas mais recentes do período.</p>}
        </section>

        <section aria-labelledby="titulo-estoque" className={`p-3.5 sm:p-5 ${e.cartao}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="titulo-estoque" className="text-lg font-semibold">Estoque: {plural(r.estoque)}</h2>
              <p className={`text-sm ${e.suave}`}>{r.custoMedio > 0 ? `custo médio ${formatarMoeda(r.custoMedio)} por placa` : "registre uma compra para calcular o custo médio"}</p>
            </div>
            <RegistrarCompra tema={tema} modelos={dados.modelosCompra} />
          </div>
          {dados.compras.length > 0 && (
            <ul className={`mt-3 divide-y border-t ${e.divisor}`}>
              {dados.compras.map((c) => {
                const data = dataCurta.format(new Date(c.comprada_em));
                return (
                  <li key={c.id} className="flex min-w-0 items-center gap-3 py-2.5">
                    <span className={`w-11 shrink-0 text-xs tabular-nums ${e.suave}`}>{data}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">+{plural(c.quantidade)}</p>
                      <p className={`truncate text-xs ${e.suave}`}>{formatarMoeda(c.custo_unitario)} cada</p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">{formatarMoeda(Math.round(c.quantidade * c.custo_unitario * 100) / 100)}</span>
                    <div className="-mr-2 flex shrink-0">
                      <EditarCompra tema={tema} compra={c} descricao={`de ${plural(c.quantidade)} (${data})`} />
                      <ExcluirLancamento tema={tema} tipo="compra" id={c.id} descricao={`de ${plural(c.quantidade)} (${data})`} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
