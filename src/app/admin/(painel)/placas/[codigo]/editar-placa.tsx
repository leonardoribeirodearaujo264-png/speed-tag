"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Layers, Link2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/admin/modal";
import { Button } from "@/components/ui/button";
import type { StatusPlaca } from "@/lib/supabase/tipos";
import { duplicarPlaca, moverLoteEmMassa, transferirEmMassa, type ResultadoMassa } from "../acoes-massa";
import { GeradorLink } from "@/components/link-avaliacao/gerador-link";
import { ativarPlacaPeloAdmin, vincularLinkAPlaca } from "@/lib/acoes/link-avaliacao";

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

/** Ações de edição da placa: mover de lote, transferir, trocar empresa e duplicar. */
export function EditarPlaca({ codigo, status, loteAtual, lotes, emailCliente }: {
  codigo: string;
  status: StatusPlaca;
  emailCliente: string | null;
  loteAtual: string | null;
  lotes: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [janela, setJanela] = useState<Janela>(null);
  const [lote, setLote] = useState(loteAtual ?? "");
  const [email, setEmail] = useState("");
  const [emailAtivacao, setEmailAtivacao] = useState(emailCliente ?? "");
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
  const podeVincularLink = status === "ativa" || status === "disponivel" || status === "atribuida";
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
        {podeVincularLink && (
          <Button variant="outline" className={botao} onClick={() => setJanela("empresa")} disabled={pendente}>
            <Link2 /> {status === "ativa" ? "Trocar link de avaliação" : "Gerar link e ativar"}
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

      <Modal
        aberto={janela === "empresa"}
        aoFechar={fechar}
        titulo={status === "ativa" ? "Trocar link de avaliação" : "Gerar link e ativar"}
        descricao={status === "ativa" ? "O NFC e o QR passam a levar ao novo link. Fica registrado no histórico." : "Gere o link, confira e ative a placa para o cliente do e-mail."}
      >
        <GeradorLink
          rotuloVincular={status === "ativa" ? "Vincular à plaquinha" : "Vincular e ativar"}
          aoVincular={(v) => (status === "ativa" ? vincularLinkAPlaca(codigo, v) : ativarPlacaPeloAdmin(codigo, emailAtivacao, v))}
          aoConcluir={() => {
            setJanela(null);
            router.refresh();
          }}
          antesDeVincular={
            status === "ativa" ? undefined : (
              <label className={rotuloCampo}>
                E-mail do cliente (recebe o acesso)
                <input type="email" required value={emailAtivacao} onChange={(e) => setEmailAtivacao(e.target.value)} className={campo} placeholder="cliente@empresa.com" />
              </label>
            )
          }
        />
      </Modal>
    </>
  );
}
