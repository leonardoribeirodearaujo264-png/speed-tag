"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban, Copy, Download, Eye, FileSpreadsheet, FolderArchive, Layers, Loader2, Lock, MoreHorizontal, Nfc, Power, UserPlus, Users, X, CopyPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/admin/modal";
import { PilulaStatus } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { StatusPlaca } from "@/lib/supabase/tipos";
import { alternarEmMassa, atribuirEmMassa, duplicarPlaca, moverLoteEmMassa, transferirEmMassa, type ResultadoMassa } from "./acoes-massa";

export type LinhaPlaca = {
  id: string;
  codigo: string;
  status: StatusPlaca;
  empresa: string | null;
  lote: string | null;
  nfc: "travado" | "gravado" | "pendente";
  criadaEm: string;
  linkAtivacao: string;
};

type Janela = "atribuir" | "transferir" | "lote" | "desativar" | null;

const campo = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-marca focus:ring-4 focus:ring-marca/15";

function MenuLinha({ linha, executar }: { linha: LinhaPlaca; executar: (acao: () => Promise<ResultadoMassa>) => void }) {
  const [aberto, setAberto] = useState(false);
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !area.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100";
  const fechar = () => setAberto(false);

  return (
    <div ref={area} className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-haspopup="menu" aria-expanded={aberto} aria-label={`Ações da placa ${linha.codigo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <MoreHorizontal className="size-5" />
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95">
          <Link role="menuitem" href={`/admin/placas/${linha.codigo}`} className={item} onClick={fechar}>
            <Eye className="size-4 text-slate-400" /> Ver detalhes
          </Link>
          <button role="menuitem" type="button" className={item} onClick={async () => {
            fechar();
            try {
              await navigator.clipboard.writeText(linha.linkAtivacao);
              toast.success("Link de ativação copiado");
            } catch {
              toast.error("Não foi possível copiar.");
            }
          }}>
            <Copy className="size-4 text-slate-400" /> Copiar link de ativação
          </button>
          <a role="menuitem" href={`/api/admin/placas/${linha.codigo}/qr?formato=png&tamanho=1024&baixar=1`} className={item} onClick={fechar}>
            <Download className="size-4 text-slate-400" /> Baixar QR Code
          </a>
          <button role="menuitem" type="button" className={item} onClick={() => { fechar(); executar(() => duplicarPlaca(linha.codigo)); }}>
            <CopyPlus className="size-4 text-slate-400" /> Duplicar placa
          </button>
          <div className="my-1 h-px bg-slate-100" />
          {linha.status === "desativada" ? (
            <button role="menuitem" type="button" className={item} onClick={() => { fechar(); executar(() => alternarEmMassa([linha.codigo], "reativar")); }}>
              <Power className="size-4 text-emerald-600" /> Reativar
            </button>
          ) : (
            <button role="menuitem" type="button" className={`${item} text-red-600 hover:bg-red-50`} onClick={() => { fechar(); executar(() => alternarEmMassa([linha.codigo], "desativar")); }}>
              <Ban className="size-4" /> Desativar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TabelaPlacas({ linhas, lotes }: { linhas: LinhaPlaca[]; lotes: Array<{ id: string; nome: string }> }) {
  const router = useRouter();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [janela, setJanela] = useState<Janela>(null);
  const [email, setEmail] = useState("");
  const [lote, setLote] = useState("");
  const [pendente, iniciar] = useTransition();

  const codigos = [...selecionadas];
  const todas = linhas.length > 0 && linhas.every((l) => selecionadas.has(l.codigo));

  const alternar = (codigo: string) =>
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(codigo)) nova.delete(codigo);
      else nova.add(codigo);
      return nova;
    });

  function executar(acao: () => Promise<ResultadoMassa>) {
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.success(r.mensagem);
        setSelecionadas(new Set());
        setJanela(null);
        setEmail("");
        router.refresh();
      } else {
        toast.error(r.mensagem);
      }
    });
  }

  const exportar = (formato: "csv" | "zip") => `/api/admin/placas/exportar?formato=${formato}&codigos=${encodeURIComponent(codigos.join(","))}`;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="w-10 py-3 pl-5">
                <input type="checkbox" aria-label="Selecionar todas desta página" checked={todas} onChange={() => setSelecionadas(todas ? new Set() : new Set(linhas.map((l) => l.codigo)))} className="size-4 accent-marca" />
              </th>
              <th className="px-3 py-3 font-medium">Código</th>
              <th className="px-3 py-3 font-medium">Situação</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">Empresa</th>
              <th className="hidden px-3 py-3 font-medium sm:table-cell">Lote</th>
              <th className="px-3 py-3 font-medium">NFC</th>
              <th className="hidden px-3 py-3 font-medium lg:table-cell">Criada em</th>
              <th className="w-12 py-3 pr-4" aria-label="Ações" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className={`transition-colors ${selecionadas.has(l.codigo) ? "bg-marca-claro/60" : "hover:bg-slate-50/70"}`}>
                <td className="py-3 pl-5">
                  <input type="checkbox" aria-label={`Selecionar ${l.codigo}`} checked={selecionadas.has(l.codigo)} onChange={() => alternar(l.codigo)} className="size-4 accent-marca" />
                </td>
                <td className="px-3 py-3">
                  <Link href={`/admin/placas/${l.codigo}`} className="font-mono font-semibold tracking-wider text-slate-900 hover:text-marca-texto hover:underline">{l.codigo}</Link>
                </td>
                <td className="px-3 py-3"><PilulaStatus status={l.status} /></td>
                <td className="hidden max-w-48 truncate px-3 py-3 text-slate-600 md:table-cell">{l.empresa ?? <span className="text-slate-400">-</span>}</td>
                <td className="hidden px-3 py-3 text-slate-500 sm:table-cell">{l.lote ?? "Avulsa"}</td>
                <td className="px-3 py-3">
                  {l.nfc === "travado" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Lock className="size-3.5" /> Travado</span>
                  ) : l.nfc === "gravado" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-marca-texto"><Nfc className="size-3.5" /> Gravado</span>
                  ) : (
                    <span className="text-xs text-slate-400">Pendente</span>
                  )}
                </td>
                <td className="hidden px-3 py-3 text-slate-500 lg:table-cell">{l.criadaEm}</td>
                <td className="py-3 pr-4 text-right"><MenuLinha linha={l} executar={executar} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selecionadas.size > 0 && (
        <div className="sticky bottom-4 z-20 mx-4 mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-marca-fundo p-3 text-white shadow-2xl animate-in slide-in-from-bottom-2">
          <span className="px-2 text-sm font-medium">{selecionadas.size} selecionada{selecionadas.size > 1 ? "s" : ""}</span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {[
              { rotulo: "Atribuir", icone: UserPlus, abrir: "atribuir" as const },
              { rotulo: "Transferir", icone: Users, abrir: "transferir" as const },
              { rotulo: "Mover lote", icone: Layers, abrir: "lote" as const },
            ].map(({ rotulo, icone: Icone, abrir }) => (
              <button key={rotulo} type="button" disabled={pendente} onClick={() => setJanela(abrir)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
                <Icone className="size-4" /> {rotulo}
              </button>
            ))}
            <button type="button" disabled={pendente} onClick={() => executar(() => alternarEmMassa(codigos, "reativar"))} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
              <Power className="size-4" /> Reativar
            </button>
            <button type="button" disabled={pendente} onClick={() => setJanela("desativar")} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/30">
              <Ban className="size-4" /> Desativar
            </button>
            <a href={exportar("csv")} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"><FileSpreadsheet className="size-4" /> CSV</a>
            <a href={exportar("zip")} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"><FolderArchive className="size-4" /> QR Codes</a>
          </div>
          {pendente && <Loader2 className="size-4 animate-spin" aria-label="Processando" />}
          <button type="button" onClick={() => setSelecionadas(new Set())} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10" aria-label="Limpar seleção"><X className="size-4" /></button>
        </div>
      )}

      <Modal
        aberto={janela === "atribuir" || janela === "transferir"}
        aoFechar={() => setJanela(null)}
        titulo={janela === "atribuir" ? "Atribuir a um cliente" : "Transferir para outro cliente"}
        descricao={janela === "atribuir" ? "As placas selecionadas precisam estar em estoque." : "Placas atribuídas ou ativas passam para a conta informada. As ativas continuam funcionando."}
      >
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); executar(() => (janela === "atribuir" ? atribuirEmMassa(codigos, email) : transferirEmMassa(codigos, email))); }}>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            E-mail da conta do cliente
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} placeholder="cliente@empresa.com" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setJanela(null)}>Cancelar</Button>
            <Button type="submit" disabled={pendente || !email.trim()}>{pendente && <Loader2 className="animate-spin" />} Confirmar ({selecionadas.size})</Button>
          </div>
        </form>
      </Modal>

      <Modal aberto={janela === "lote"} aoFechar={() => setJanela(null)} titulo="Mover para lote" descricao="As placas selecionadas mudam de lote; nada mais é alterado.">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); executar(() => moverLoteEmMassa(codigos, lote || null)); }}>
          <select value={lote} onChange={(e) => setLote(e.target.value)} className={campo}>
            <option value="">Sem lote (avulsas)</option>
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setJanela(null)}>Cancelar</Button>
            <Button type="submit" disabled={pendente}>{pendente && <Loader2 className="animate-spin" />} Mover ({selecionadas.size})</Button>
          </div>
        </form>
      </Modal>

      <Modal aberto={janela === "desativar"} aoFechar={() => setJanela(null)} titulo={`Desativar ${selecionadas.size} placa${selecionadas.size > 1 ? "s" : ""}?`} descricao="O NFC e o QR Code param de levar à avaliação. Dá para reativar depois.">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setJanela(null)}>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={pendente} onClick={() => executar(() => alternarEmMassa(codigos, "desativar"))}>
            {pendente && <Loader2 className="animate-spin" />} Desativar
          </Button>
        </div>
      </Modal>
    </>
  );
}
