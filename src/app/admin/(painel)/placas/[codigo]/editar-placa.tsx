"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, CopyPlus, Layers, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/admin/modal";
import { Button } from "@/components/ui/button";
import type { EmpresaEncontrada } from "@/lib/google/places";
import type { StatusPlaca } from "@/lib/supabase/tipos";
import { duplicarPlaca, moverLoteEmMassa, transferirEmMassa, type ResultadoMassa } from "../acoes-massa";
import { pesquisarEmpresaAdmin, trocarEmpresaAdmin } from "./acoes-detalhe";

type Janela = "lote" | "transferir" | "empresa" | null;

const campo = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-marca focus:ring-4 focus:ring-marca/15";
const rotuloCampo = "flex flex-col gap-1.5 text-sm font-medium text-slate-700";

function Rodape({ pendente, rotulo, aoCancelar, desabilitado }: { pendente: boolean; rotulo: string; aoCancelar: () => void; desabilitado?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="outline" onClick={aoCancelar}>Cancelar</Button>
      <Button type="submit" disabled={pendente || desabilitado}>
        {pendente && <Loader2 className="animate-spin" />} {rotulo}
      </Button>
    </div>
  );
}

function TrocarEmpresa({ codigo, pendente, executar, aoCancelar }: {
  codigo: string;
  pendente: boolean;
  executar: (acao: () => Promise<ResultadoMassa>) => void;
  aoCancelar: () => void;
}) {
  const [modo, setModo] = useState<"google" | "link">("google");
  const [consulta, setConsulta] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<EmpresaEncontrada[] | null>(null);
  const [escolhida, setEscolhida] = useState<EmpresaEncontrada | null>(null);
  const [nome, setNome] = useState("");
  const [link, setLink] = useState("");

  async function buscar() {
    setBuscando(true);
    setEscolhida(null);
    const r = await pesquisarEmpresaAdmin(consulta);
    setBuscando(false);
    if ("erro" in r) {
      toast.error(r.erro);
      setResultados(null);
    } else {
      setResultados(r.empresas);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (modo === "google") {
      if (escolhida) executar(() => trocarEmpresaAdmin(codigo, { tipo: "google", placeId: escolhida.id, nome: escolhida.nome }));
    } else {
      executar(() => trocarEmpresaAdmin(codigo, { tipo: "link", nome, link }));
    }
  }

  const aba = (ativo: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${ativo ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`;

  return (
    <form className="flex flex-col gap-4" onSubmit={enviar}>
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        <button type="button" role="tab" aria-selected={modo === "google"} className={aba(modo === "google")} onClick={() => setModo("google")}>Buscar no Google</button>
        <button type="button" role="tab" aria-selected={modo === "link"} className={aba(modo === "link")} onClick={() => setModo("link")}>Link manual</button>
      </div>

      {modo === "google" ? (
        <>
          <div className="flex gap-2">
            <input
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (consulta.trim().length >= 3) void buscar();
                }
              }}
              placeholder="Nome da empresa e cidade"
              aria-label="Nome da empresa e cidade"
              className={campo}
            />
            <Button type="button" variant="outline" className="h-11" disabled={buscando || consulta.trim().length < 3} onClick={() => void buscar()} aria-label="Buscar">
              {buscando ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>
          {resultados !== null && (
            resultados.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">Nada encontrado. Tente outro nome ou use o link manual.</p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto" role="listbox" aria-label="Empresas encontradas">
                {resultados.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={escolhida?.id === r.id}
                      onClick={() => setEscolhida(r)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${escolhida?.id === r.id ? "border-marca bg-marca-claro" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                    >
                      <span className="block text-sm font-medium text-slate-900">{r.nome}</span>
                      {r.endereco && <span className="block truncate text-xs text-slate-500">{r.endereco}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </>
      ) : (
        <>
          <label className={rotuloCampo}>
            Nome da empresa
            <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200} className={campo} />
          </label>
          <label className={rotuloCampo}>
            Link de avaliação do Google
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} required placeholder="https://g.page/r/..." className={campo} />
          </label>
        </>
      )}

      <Rodape pendente={pendente} rotulo="Trocar empresa" aoCancelar={aoCancelar} desabilitado={modo === "google" ? !escolhida : !nome.trim() || !link.trim()} />
    </form>
  );
}

/** Ações de edição da placa: mover de lote, transferir, trocar empresa e duplicar. */
export function EditarPlaca({ codigo, status, loteAtual, lotes }: {
  codigo: string;
  status: StatusPlaca;
  loteAtual: string | null;
  lotes: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [janela, setJanela] = useState<Janela>(null);
  const [lote, setLote] = useState(loteAtual ?? "");
  const [email, setEmail] = useState("");
  const [pendente, iniciar] = useTransition();
  const fechar = () => setJanela(null);

  function executar(acao: () => Promise<ResultadoMassa>) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.success(r.mensagem);
        setJanela(null);
        setEmail("");
        router.refresh();
      } else {
        toast.error(r.mensagem);
      }
    });
  }

  const podeTransferir = status === "atribuida" || status === "ativa";
  const botao = "justify-start";

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className={botao} onClick={() => setJanela("lote")} disabled={pendente}>
          <Layers /> Mover de lote
        </Button>
        <Button variant="outline" className={botao} onClick={() => executar(() => duplicarPlaca(codigo))} disabled={pendente}>
          {pendente ? <Loader2 className="animate-spin" /> : <CopyPlus />} Duplicar placa
        </Button>
        {podeTransferir && (
          <Button variant="outline" className={botao} onClick={() => setJanela("transferir")} disabled={pendente}>
            <Users /> Transferir cliente
          </Button>
        )}
        {status === "ativa" && (
          <Button variant="outline" className={botao} onClick={() => setJanela("empresa")} disabled={pendente}>
            <Building2 /> Trocar empresa
          </Button>
        )}
      </div>
      {!podeTransferir && (
        <p className="mt-3 text-xs text-slate-500">Para vincular a um cliente, use Atribuir em Estoque e situação. Transferir e trocar empresa aparecem quando a placa tiver dono.</p>
      )}

      <Modal aberto={janela === "lote"} aoFechar={fechar} titulo="Mover de lote" descricao="Só o lote muda; dono, empresa e NFC continuam iguais.">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); executar(() => moverLoteEmMassa([codigo], lote || null)); }}>
          <select value={lote} onChange={(e) => setLote(e.target.value)} className={campo} aria-label="Lote">
            <option value="">Sem lote (avulsa)</option>
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <Rodape pendente={pendente} rotulo="Mover" aoCancelar={fechar} desabilitado={(lote || null) === loteAtual} />
        </form>
      </Modal>

      <Modal aberto={janela === "transferir"} aoFechar={fechar} titulo="Transferir para outro cliente" descricao="A placa passa para a conta informada. Se estiver ativa, continua levando à mesma avaliação.">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); executar(() => transferirEmMassa([codigo], email)); }}>
          <label className={rotuloCampo}>
            E-mail da conta do cliente
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} placeholder="cliente@empresa.com" />
          </label>
          <Rodape pendente={pendente} rotulo="Transferir" aoCancelar={fechar} desabilitado={!email.trim()} />
        </form>
      </Modal>

      <Modal aberto={janela === "empresa"} aoFechar={fechar} titulo="Trocar empresa" descricao="O NFC e o QR passam a levar à avaliação da nova empresa. Fica registrado no histórico.">
        <TrocarEmpresa codigo={codigo} pendente={pendente} executar={executar} aoCancelar={fechar} />
      </Modal>
    </>
  );
}
