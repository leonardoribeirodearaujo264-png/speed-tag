import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Clock, Nfc, Package, Plus, Tags, Trophy, UserPlus } from "lucide-react";
import {
  CabecalhoPagina,
  CartaoIndicador,
  EstadoVazio,
  GraficoLeituras,
  Painel,
  TituloPainel,
} from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { formatarData } from "@/lib/placas/rotulos";
import type { AcaoHistorico, EstatisticasAdmin } from "@/lib/supabase/tipos";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Início" };

const ROTULO_ACAO: Record<AcaoHistorico, string> = {
  criou: "Placa criada",
  gravou_nfc: "NFC gravado",
  travou_nfc: "NFC travado",
  ativou: "Placa ativada pelo cliente",
  trocou_destino: "Destino trocado",
  bloqueou: "Placa bloqueada",
  desbloqueou: "Placa desbloqueada",
  resetou: "Placa resetada",
  reservou: "Reservada",
  atribuiu: "Atribuída a um cliente",
  liberou: "Devolvida ao estoque",
  desativou: "Desativada",
  reativou: "Reativada",
  tentativa_negada: "Tentativa de ativação negada",
  editou_empresa: "Nome da empresa alterado",
  transferiu: "Transferida para outro cliente",
  mudou_lote: "Mudou de lote",
  reivindicou: "Placa assumida pelo cliente",
};

function porcentagem(parte: number, total: number) {
  return total === 0 ? "0%" : `${Math.round((parte / total) * 100)}%`;
}

export default async function InicioAdmin() {
  const { supabase, usuarioId } = await exigirAdmin("/admin");

  const [{ data: estatisticas, error }, { data: perfil }, { data: eventos }] = await Promise.all([
    supabase.rpc("estatisticas_admin", { p_dias: 30 }),
    supabase.from("perfis").select("nome").eq("id", usuarioId).maybeSingle(),
    supabase.from("historico_placa").select("id, acao, placa_id, criado_em").order("criado_em", { ascending: false }).limit(8),
  ]);

  if (error || !estatisticas) {
    const faltaMigration = error?.code === "PGRST202";
    return (
      <Painel>
        <EstadoVazio
          icone={BarChart3}
          titulo={faltaMigration ? "Falta atualizar o banco" : "Não foi possível carregar os indicadores"}
          descricao={
            faltaMigration
              ? "Rode no SQL Editor do Supabase o arquivo 20261123000007_painel_admin.sql e recarregue esta página."
              : "Recarregue a página. Se continuar, confira a conexão com o Supabase."
          }
        />
      </Painel>
    );
  }

  const e = estatisticas as EstatisticasAdmin;
  const codigos = new Map<string, string>();
  const idsEventos = [...new Set((eventos ?? []).map((ev) => ev.placa_id))];
  if (idsEventos.length) {
    const { data } = await supabase.from("placas").select("id, codigo").in("id", idsEventos);
    for (const p of data ?? []) codigos.set(p.id, p.codigo);
  }

  const primeiroNome = perfil?.nome?.split(" ")[0];

  return (
    <div>
      <CabecalhoPagina
        sobretitulo="Visão geral"
        titulo={primeiroNome ? `Olá, ${primeiroNome}` : "Olá"}
        descricao="Acompanhe as placas, as ativações e as leituras dos últimos 30 dias."
        acoes={
          <>
            <Link href="/admin/lotes/novo" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Criar lote
            </Link>
            <Link href="/admin/placas/nova" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden /> Criar placa
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <CartaoIndicador
          rotulo="Em estoque"
          valor={e.placas.disponiveis + e.placas.reservadas}
          icone={Package}
          tom="cinza"
          detalhe={`${e.placas.reservadas} reservadas · ${e.placas.total} criadas`}
        />
        <CartaoIndicador
          rotulo="Aguardando ativação"
          valor={e.placas.atribuidas}
          icone={Clock}
          tom="ambar"
          detalhe="Já na conta do cliente"
        />
        <CartaoIndicador
          rotulo="Ativas"
          valor={e.placas.ativas}
          icone={CheckCircle2}
          tom="verde"
          detalhe={`${porcentagem(e.placas.ativas, e.placas.total)} do total · ${e.placas.desativadas} desativadas`}
        />
        <CartaoIndicador
          rotulo="Leituras em 30 dias"
          valor={e.leituras_periodo}
          icone={BarChart3}
          detalhe={`${e.usuarios} usuários · ${e.empresas} empresas`}
        />
      </div>

      {(e.placas.nfc_pendente > 0 || e.pedidos_admin > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {e.placas.nfc_pendente > 0 && (
            <Link
              href="/admin/placas?nfc=pendente"
              className="group flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-50"
            >
              <Nfc className="size-5 shrink-0 text-amber-600" aria-hidden />
              <span className="flex-1">
                <span className="font-semibold">{e.placas.nfc_pendente}</span> {e.placas.nfc_pendente === 1 ? "placa ainda sem" : "placas ainda sem"} NFC gravado
              </span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
          {e.pedidos_admin > 0 && (
            <Link
              href="/admin/administradores"
              className="group flex items-center gap-3 rounded-2xl border border-marca-borda bg-marca-claro px-4 py-3 text-sm text-marca-texto transition-colors hover:bg-marca-claro/70"
            >
              <UserPlus className="size-5 shrink-0" aria-hidden />
              <span className="flex-1">
                <span className="font-semibold">{e.pedidos_admin}</span> {e.pedidos_admin === 1 ? "pedido" : "pedidos"} de acesso de administrador
              </span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Painel>
          <TituloPainel titulo="Leituras por dia" descricao="Toques no NFC e leituras do QR Code" />
          <div className="px-4 pb-5 sm:px-6">
            {e.leituras_periodo === 0 ? (
              <EstadoVazio icone={BarChart3} titulo="Nenhuma leitura ainda" descricao="Quando os clientes tocarem nas placas, o gráfico aparece aqui." />
            ) : (
              <GraficoLeituras serie={e.serie} />
            )}
          </div>
        </Painel>

        <Painel>
          <TituloPainel titulo="Placas mais lidas" descricao="Últimos 30 dias" />
          {e.top_placas.length === 0 ? (
            <EstadoVazio icone={Trophy} titulo="Sem ranking ainda" descricao="O ranking aparece depois das primeiras leituras." />
          ) : (
            <ol className="px-3 pb-3">
              {e.top_placas.map((t, i) => {
                const largura = Math.max(8, Math.round((t.leituras / e.top_placas[0].leituras) * 100));
                return (
                  <li key={t.codigo}>
                    <Link href={`/admin/placas/${t.codigo}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50">
                      <span className="w-4 text-sm font-semibold text-slate-400 tabular-nums">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">{t.empresa ?? t.codigo}</span>
                          <span className="text-sm text-slate-500 tabular-nums">{t.leituras}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-marca to-marca-ciano" style={{ width: `${largura}%` }} />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Painel>
      </div>

      <Painel className="mt-6">
        <TituloPainel
          titulo="Atividade recente"
          acao={
            <Link href="/admin/placas" className="text-sm font-medium text-marca-texto hover:underline">
              Ver placas
            </Link>
          }
        />
        {!eventos?.length ? (
          <EstadoVazio icone={Tags} titulo="Nada por aqui ainda" descricao="Crie a primeira placa para começar." />
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {eventos.map((ev) => {
              const codigo = codigos.get(ev.placa_id);
              return (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm sm:px-6">
                  <span className="min-w-0 text-slate-700">{ROTULO_ACAO[ev.acao]}</span>
                  <span className="flex items-center gap-3 sm:gap-4">
                    {codigo && (
                      <Link href={`/admin/placas/${codigo}`} className="font-mono text-xs font-medium tracking-wider text-marca-texto hover:underline">
                        {codigo}
                      </Link>
                    )}
                    <time className="text-slate-400 tabular-nums" dateTime={ev.criado_em}>
                      {formatarData(ev.criado_em)}
                    </time>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Painel>
    </div>
  );
}
