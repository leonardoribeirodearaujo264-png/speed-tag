"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Ban, Bookmark, Loader2, Power, Undo2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { StatusPlaca } from "@/lib/supabase/tipos";
import {
  atribuirPlacaAcao,
  desativarPlacaAcao,
  liberarPlacaAcao,
  reativarPlacaAcao,
  reservarPlacaAcao,
  type ResultadoEstoque,
} from "./acoes-placa";

type Props = {
  placaId: string;
  codigo: string;
  status: StatusPlaca;
  reservadaPara: string | null;
  cliente: { nome: string | null; email: string | null } | null;
};

type Formulario = "atribuir" | "reservar" | "desativar" | null;

const classeCampo =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-marca focus:ring-4 focus:ring-marca/15";

const EXPLICACAO: Record<StatusPlaca, string> = {
  disponivel: "Em estoque. Atribua a um cliente para ele poder ativar, ou reserve.",
  reservada: "Separada para alguém, ainda sem conta vinculada.",
  atribuida: "Na conta do cliente. Ele ativa ao escolher a empresa no painel dele.",
  ativa: "Funcionando: o NFC e o QR Code levam à avaliação da empresa.",
  desativada: "Desativada: o NFC e o QR Code não levam a lugar nenhum.",
};

export function PainelEstoque({ placaId, codigo, status, reservadaPara, cliente }: Props) {
  const [aberto, setAberto] = useState<Formulario>(null);
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();

  const executar = (acao: () => Promise<ResultadoEstoque>) =>
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.success(r.mensagem);
        setAberto(null);
        setValor("");
      } else {
        toast.error(r.mensagem);
      }
    });

  const abrir = (f: Formulario) => {
    setValor("");
    setAberto(f);
  };

  const formulario = (titulo: string, rotulo: string, tipo: "email" | "text", confirmar: string, aoConfirmar: () => void, perigo = false): ReactNode => (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-sm font-medium text-slate-900">{titulo}</p>
      <label className="flex flex-col gap-1.5 text-sm text-slate-600">
        {rotulo}
        <input
          type={tipo}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={classeCampo}
          autoFocus
          maxLength={200}
          inputMode={tipo === "email" ? "email" : undefined}
        />
      </label>
      <div className="flex gap-2">
        <Button variant={perigo ? "destructive" : "default"} disabled={pendente || (!perigo && !valor.trim())} onClick={aoConfirmar}>
          {pendente && <Loader2 className="animate-spin" aria-hidden />}
          {confirmar}
        </Button>
        <Button variant="outline" disabled={pendente} onClick={() => setAberto(null)}>
          Cancelar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">{EXPLICACAO[status]}</p>

      {status === "reservada" && reservadaPara && (
        <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800 ring-1 ring-violet-200">
          Reservada para: <span className="font-medium">{reservadaPara}</span>
        </p>
      )}
      {(status === "atribuida" || status === "ativa") && cliente && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          Cliente: <span className="font-medium">{cliente.nome ?? cliente.email}</span>
        </p>
      )}

      {aberto === "atribuir" &&
        formulario("Atribuir a um cliente", "E-mail da conta do cliente", "email", "Atribuir", () =>
          executar(() => atribuirPlacaAcao(codigo, valor)),
        )}
      {aberto === "reservar" &&
        formulario("Reservar placa", "Para quem ou qual pedido", "text", "Reservar", () =>
          executar(() => reservarPlacaAcao(placaId, codigo, valor)),
        )}
      {aberto === "desativar" &&
        formulario(
          "Desativar placa",
          "Motivo (opcional)",
          "text",
          "Desativar",
          () => executar(() => desativarPlacaAcao(placaId, codigo, valor)),
          true,
        )}

      {aberto === null && (
        <div className="flex flex-wrap gap-2">
          {(status === "disponivel" || status === "reservada") && (
            <Button onClick={() => abrir("atribuir")}>
              <UserPlus aria-hidden /> Atribuir a cliente
            </Button>
          )}
          {status === "disponivel" && (
            <Button variant="outline" onClick={() => abrir("reservar")}>
              <Bookmark aria-hidden /> Reservar
            </Button>
          )}
          {(status === "reservada" || status === "atribuida") && (
            <Button variant="outline" disabled={pendente} onClick={() => executar(() => liberarPlacaAcao(placaId, codigo))}>
              {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />} Devolver ao estoque
            </Button>
          )}
          {status === "desativada" ? (
            <Button disabled={pendente} onClick={() => executar(() => reativarPlacaAcao(placaId, codigo))}>
              {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Power aria-hidden />} Reativar
            </Button>
          ) : (
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => abrir("desativar")}>
              <Ban aria-hidden /> Desativar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
