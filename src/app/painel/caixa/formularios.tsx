"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CANAIS, PAGAMENTOS, STATUS_VENDA, formatarMoeda, lerValor, totalVenda, valorParaCampo,
  type ModeloCompra, type ModeloVenda,
} from "@/lib/caixa/regras";
import type { CanalVenda, PagamentoVenda, StatusVenda } from "@/lib/supabase/tipos";
import { lancarVenda, registrarCompra, type EstadoCaixa } from "./acoes";

const INICIAL: EstadoCaixa = { ok: false, mensagem: null };

/** Grupo de opções em "pílulas" (rádio nativo, acessível por teclado). */
function Opcoes<T extends string>({ nome, rotulo, opcoes, valor, aoMudar }: {
  nome: string; rotulo: string; opcoes: Record<T, string>; valor: T; aoMudar: (valor: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-slate-800">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(opcoes) as T[]).map((opcao) => (
          <label key={opcao} className="cursor-pointer">
            <input type="radio" name={nome} value={opcao} checked={opcao === valor} onChange={() => aoMudar(opcao)} className="peer sr-only" />
            <span className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm text-slate-700 transition-colors peer-checked:border-marca peer-checked:bg-marca-claro peer-checked:font-medium peer-checked:text-marca-texto peer-focus-visible:ring-4 peer-focus-visible:ring-marca/20 hover:border-slate-300">
              {opcoes[opcao]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CampoNumero({ id, rotulo, ...props }: { id: string; rotulo: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-slate-800">{rotulo}</Label>
      <Input id={id} name={id} required className="h-11 text-base tabular-nums" {...props} />
    </div>
  );
}

/** Lançamentos já usados: um toque preenche o formulário inteiro. */
function Atalhos<T>({ modelos, rotulo, aoEscolher }: { modelos: readonly T[]; rotulo: (m: T) => string; aoEscolher: (m: T) => void }) {
  if (!modelos.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><History className="size-4 text-slate-500" aria-hidden /> Usados antes</p>
      <div className="flex flex-wrap gap-2">
        {modelos.map((m) => {
          const texto = rotulo(m);
          return (
            <button key={texto} type="button" onClick={() => aoEscolher(m)} aria-label={`Preencher com ${texto}`}
              className="inline-flex min-h-11 max-w-full items-center rounded-xl border border-dashed border-marca/50 bg-marca-claro/40 px-3 text-left text-sm text-marca-texto hover:bg-marca-claro focus-visible:ring-4 focus-visible:ring-marca/20">
              <span className="truncate">{texto}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Fecha o diálogo e avisa no toast quando a ação dá certo. */
function useSucesso(estado: EstadoCaixa, fechar: () => void) {
  const fecharAtual = useRef(fechar);
  useEffect(() => { fecharAtual.current = fechar; });
  // Só quando chega um novo resultado da ação (o objeto de estado muda).
  useEffect(() => {
    if (estado.ok && estado.mensagem) {
      toast.success(estado.mensagem);
      fecharAtual.current();
    }
  }, [estado]);
}

const plural = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "placa" : "placas"}`;
const rotuloVenda = (m: ModeloVenda) =>
  `${plural(m.quantidade)} · ${formatarMoeda(m.valor_unitario)} · custo ${formatarMoeda(m.custo_unitario)} · ${CANAIS[m.canal]} · ${PAGAMENTOS[m.pagamento]}`;
const rotuloCompra = (m: ModeloCompra) => `${plural(m.quantidade)} · ${formatarMoeda(m.custo_unitario)} cada`;

type CamposVenda = { quantidade: string; valor: string; custo: string; canal: CanalVenda; pagamento: PagamentoVenda; status: StatusVenda };

function FormVenda({ custoMedio, modelos, fechar }: { custoMedio: number; modelos: readonly ModeloVenda[]; fechar: () => void }) {
  const [estado, acao, salvando] = useActionState(lancarVenda, INICIAL);
  const [id] = useState(() => crypto.randomUUID());
  // Canal, pagamento e status começam como na última venda; valores, em branco até escolher um atalho.
  const ultima = modelos[0];
  const [campos, setCampos] = useState<CamposVenda>({
    quantidade: "1", valor: "", custo: valorParaCampo(custoMedio),
    canal: ultima?.canal ?? "porta_a_porta", pagamento: ultima?.pagamento ?? "pix", status: "pago",
  });
  useSucesso(estado, fechar);
  const qtd = Number.parseInt(campos.quantidade, 10) || 0;
  const { total, lucro } = totalVenda(qtd, lerValor(campos.valor) || 0, lerValor(campos.custo) || 0);
  const definir = <K extends keyof CamposVenda>(campo: K, valor: CamposVenda[K]) => setCampos((c) => ({ ...c, [campo]: valor }));
  const aplicar = (m: ModeloVenda) => setCampos((c) => ({
    ...c, quantidade: String(m.quantidade), valor: valorParaCampo(m.valor_unitario), custo: valorParaCampo(m.custo_unitario),
    canal: m.canal, pagamento: m.pagamento, status: m.status,
  }));

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <Atalhos modelos={modelos} rotulo={rotuloVenda} aoEscolher={aplicar} />
      <div className="grid grid-cols-3 gap-2.5">
        <CampoNumero id="quantidade" rotulo="Placas" type="number" inputMode="numeric" min={1} max={100000} value={campos.quantidade} onChange={(e) => definir("quantidade", e.target.value)} />
        <CampoNumero id="valor_unitario" rotulo="Valor un." inputMode="decimal" placeholder="0,00" value={campos.valor} onChange={(e) => definir("valor", e.target.value)} autoFocus={!modelos.length} />
        <CampoNumero id="custo_unitario" rotulo="Custo un." inputMode="decimal" placeholder="0,00" value={campos.custo} onChange={(e) => definir("custo", e.target.value)} />
      </div>
      <Opcoes nome="canal" rotulo="Canal" opcoes={CANAIS} valor={campos.canal} aoMudar={(v) => definir("canal", v)} />
      <Opcoes nome="pagamento" rotulo="Pagamento" opcoes={PAGAMENTOS} valor={campos.pagamento} aoMudar={(v) => definir("pagamento", v)} />
      <Opcoes nome="status" rotulo="Status" opcoes={STATUS_VENDA} valor={campos.status} aoMudar={(v) => definir("status", v)} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" aria-live="polite">
        <span>Total <strong className="tabular-nums">{formatarMoeda(total)}</strong></span>
        <span>Lucro <strong className={`tabular-nums ${lucro < 0 ? "text-red-700" : ""}`}>{formatarMoeda(lucro)}</strong></span>
      </div>
      {estado.mensagem && !estado.ok && <p role="alert" className="text-sm text-red-700">{estado.mensagem}</p>}
      <Button type="submit" className="min-h-12 w-full text-base" disabled={salvando}>{salvando ? "Salvando..." : "Salvar venda"}</Button>
    </form>
  );
}

function FormCompra({ modelos, fechar }: { modelos: readonly ModeloCompra[]; fechar: () => void }) {
  const [estado, acao, salvando] = useActionState(registrarCompra, INICIAL);
  const [id] = useState(() => crypto.randomUUID());
  const [campos, setCampos] = useState({ quantidade: "", custo: "" });
  useSucesso(estado, fechar);
  const qtd = Number.parseInt(campos.quantidade, 10) || 0;
  const { total } = totalVenda(qtd, lerValor(campos.custo) || 0, 0);
  const mudar = (campo: keyof typeof campos) => (e: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, [campo]: e.target.value }));
  const aplicar = (m: ModeloCompra) => setCampos({ quantidade: String(m.quantidade), custo: valorParaCampo(m.custo_unitario) });

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <Atalhos modelos={modelos} rotulo={rotuloCompra} aoEscolher={aplicar} />
      <div className="grid grid-cols-2 gap-2.5">
        <CampoNumero id="quantidade" rotulo="Placas compradas" type="number" inputMode="numeric" min={1} max={100000} value={campos.quantidade} onChange={mudar("quantidade")} autoFocus={!modelos.length} />
        <CampoNumero id="custo_unitario" rotulo="Custo un." inputMode="decimal" placeholder="0,00" value={campos.custo} onChange={mudar("custo")} />
      </div>
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700" aria-live="polite">
        Total da compra <strong className="tabular-nums text-slate-900">{formatarMoeda(total)}</strong>. Entra no estoque e no custo médio.
      </p>
      {estado.mensagem && !estado.ok && <p role="alert" className="text-sm text-red-700">{estado.mensagem}</p>}
      <Button type="submit" className="min-h-12 w-full text-base" disabled={salvando}>{salvando ? "Salvando..." : "Registrar compra"}</Button>
    </form>
  );
}

/** Cada abertura monta o formulário de novo (campos limpos e id novo contra duplicidade). */
function useDialogo() {
  const [aberto, setAberto] = useState(false);
  const [rodada, setRodada] = useState(0);
  const mudar = (valor: boolean) => { setAberto(valor); if (valor) setRodada((r) => r + 1); };
  return { aberto, rodada, mudar, fechar: () => setAberto(false) };
}

export function LancarVenda({ custoMedio, modelos }: { custoMedio: number; modelos: ModeloVenda[] }) {
  const d = useDialogo();
  return (
    <DialogoEmpresa tipo="criar" botao="Lançar venda" aberto={d.aberto} aoMudar={d.mudar}
      classeBotao="min-h-14 w-full justify-center rounded-2xl text-base font-semibold">
      <FormVenda key={d.rodada} custoMedio={custoMedio} modelos={modelos} fechar={d.fechar} />
    </DialogoEmpresa>
  );
}

export function RegistrarCompra({ modelos }: { modelos: ModeloCompra[] }) {
  const d = useDialogo();
  return (
    <DialogoEmpresa tipo="criar" botao="Compra" titulo="Registrar compra" descricao="Placas que entraram no seu estoque." aberto={d.aberto} aoMudar={d.mudar}
      classeBotao="min-h-11 shrink-0 justify-center rounded-xl border border-slate-600 bg-transparent px-3 text-sm text-white hover:bg-white/10">
      <FormCompra key={d.rodada} modelos={modelos} fechar={d.fechar} />
    </DialogoEmpresa>
  );
}
