"use client";

import { useState, useTransition } from "react";
import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban, Copy, Download, Eye, FileSpreadsheet, FolderArchive, Layers, Loader2, Lock, MoreHorizontal, Nfc, Power, UserPlus, Users, X, CopyPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/admin/modal";
import { PilulaStatus, classeCampo } from "@/components/admin/ui";
import { CartaoListagem } from "@/components/admin/cartao-listagem";
import { Button, buttonVariants } from "@/components/ui/button";
import type { StatusPlaca } from "@/lib/supabase/tipos";
import { alternarEmMassa, atribuirEmMassa, duplicarPlaca, moverLoteEmMassa, transferirEmMassa, type ResultadoMassa } from "./acoes-massa";

export type LinhaPlaca = {
  id: string;
  codigo: string;
  status: StatusPlaca;
  empresa: string | null;
  titular: string | null;
  lote: string | null;
  nfc: "travado" | "gravado" | "pendente";
  criadaEm: string;
  linkAtivacao: string;
};

type Janela = "atribuir" | "transferir" | "lote" | "desativar" | null;

/** Botões da barra de seleção em massa: 44 px no celular, compactos no desktop. */
const botaoBarra = "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm md:min-h-0";

function MenuLinha({ linha, executar }: { linha: LinhaPlaca; executar: (acao: () => Promise<ResultadoMassa>) => void }) {
  const item = "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 outline-none data-highlighted:bg-slate-100 md:min-h-0";

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger aria-label={`Ações da placa ${linha.codigo}`} className="grid size-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-marca md:size-9">
        <MoreHorizontal className="size-5" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="z-40">
          <Menu.Popup className="max-h-[var(--available-height)] w-60 max-w-[var(--available-width)] md:w-56 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <Menu.LinkItem render={<Link href={`/admin/placas/${linha.codigo}`} />} closeOnClick className={item}>
              <Eye className="size-4 text-slate-400" /> Ver detalhes
            </Menu.LinkItem>
            <Menu.Item className={item} onClick={async () => {
              try {
                await navigator.clipboard.writeText(linha.linkAtivacao);
                toast.success("Link de ativação copiado");
              } catch {
                toast.error("Não foi possível copiar.");
              }
            }}>
              <Copy className="size-4 text-slate-400" /> Copiar link de ativação
            </Menu.Item>
            <Menu.LinkItem href={`/api/admin/placas/${linha.codigo}/qr?formato=png&tamanho=1024&baixar=1`} className={item} closeOnClick>
              <Download className="size-4 text-slate-400" /> Baixar QR Code
            </Menu.LinkItem>
            <Menu.Item className={item} onClick={() => executar(() => duplicarPlaca(linha.codigo))}>
              <CopyPlus className="size-4 text-slate-400" /> Duplicar placa
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-slate-100" />
            {linha.status === "desativada" ? (
              <Menu.Item className={item} onClick={() => executar(() => alternarEmMassa([linha.codigo], "reativar"))}>
                <Power className="size-4 text-emerald-600" /> Reativar
              </Menu.Item>
            ) : (
              <Menu.Item className={`${item} text-red-600 data-highlighted:bg-red-50`} onClick={() => executar(() => alternarEmMassa([linha.codigo], "desativar"))}>
                <Ban className="size-4" /> Desativar
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function CartoesPlacas({ linhas, lotes }: { linhas: LinhaPlaca[]; lotes: Array<{ id: string; nome: string }> }) {
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
      <div className="bg-slate-50/80 p-3 sm:px-5 sm:py-4">
        <label className="mb-2 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 md:mb-4 md:min-h-0">
          <input type="checkbox" checked={todas} onChange={() => setSelecionadas(todas ? new Set() : new Set(linhas.map((l) => l.codigo)))} className="size-4 accent-marca" />
          Selecionar placas desta página
        </label>
        <ul className="grid gap-3 lg:grid-cols-2">
          {linhas.map((placa) => {
            const selecionada = selecionadas.has(placa.codigo);
            const detalhes = `/admin/placas/${placa.codigo}`;
            return (
              <li key={placa.id} className="min-w-0">
                <CartaoListagem
                  icone={<Nfc className="size-5" aria-hidden />}
                  titulo={<Link href={detalhes} className="font-mono tracking-wider hover:underline">{placa.codigo}</Link>}
                  subtitulo={placa.empresa ?? placa.titular ?? "Sem empresa vinculada"}
                  selecionado={selecionada}
                  opcoes={<>
                    {/* A caixa é pequena; o rótulo em volta dá a área de toque de 44 px no celular. */}
                    <label className="grid size-11 cursor-pointer place-items-center rounded-lg hover:bg-slate-100 md:size-9">
                      <input type="checkbox" aria-label={`Selecionar ${placa.codigo}`} checked={selecionada} onChange={() => alternar(placa.codigo)} className="size-4 accent-marca" />
                    </label>
                    <MenuLinha linha={placa} executar={executar} />
                  </>}
                  acoes={<>
                    <a href={`/api/admin/placas/${placa.codigo}/qr?formato=png&tamanho=1024&baixar=1`} className={buttonVariants({ variant: "outline" })}>
                      <Download aria-hidden /> Baixar QR
                    </a>
                    <Link href={detalhes} className={buttonVariants()}>
                      <Eye aria-hidden /> Abrir placa
                    </Link>
                  </>}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <PilulaStatus status={placa.status} />
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {placa.nfc === "travado" && <Lock className="size-3" aria-hidden />}
                      {placa.nfc === "travado" ? "NFC travado" : placa.nfc === "gravado" ? "NFC gravado" : "NFC pendente"}
                    </span>
                  </div>
                  {placa.empresa && placa.titular && <p className="break-words text-sm text-slate-600">Titular: {placa.titular}</p>}
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-slate-500">Lote</dt><dd className="break-words text-slate-700">{placa.lote ?? "Avulsa"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Criada em</dt><dd className="text-slate-700">{placa.criadaEm}</dd></div>
                  </dl>
                </CartaoListagem>
              </li>
            );
          })}
        </ul>
      </div>

      {selecionadas.size > 0 && (
        <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-marca-fundo p-3 text-white shadow-2xl animate-in slide-in-from-bottom-2 sm:mx-4 sm:mb-4">
          <span className="flex-1 px-2 text-sm font-medium sm:flex-none">{selecionadas.size} selecionada{selecionadas.size > 1 ? "s" : ""}</span>
          {pendente && <Loader2 className="size-4 animate-spin sm:order-last" aria-label="Processando" />}
          <button type="button" onClick={() => setSelecionadas(new Set())} className="grid size-11 place-items-center rounded-lg text-slate-300 hover:bg-white/10 sm:order-last md:size-8" aria-label="Limpar seleção"><X className="size-4" /></button>
          {/* No celular as ações ficam em grade de duas colunas, sem rolagem lateral. */}
          <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-1 sm:flex-wrap">
            {[
              { rotulo: "Atribuir", icone: UserPlus, abrir: "atribuir" as const },
              { rotulo: "Transferir", icone: Users, abrir: "transferir" as const },
              { rotulo: "Mover lote", icone: Layers, abrir: "lote" as const },
            ].map(({ rotulo, icone: Icone, abrir }) => (
              <button key={rotulo} type="button" disabled={pendente} onClick={() => setJanela(abrir)} className={`${botaoBarra} bg-white/10 hover:bg-white/20`}>
                <Icone className="size-4" /> {rotulo}
              </button>
            ))}
            <button type="button" disabled={pendente} onClick={() => executar(() => alternarEmMassa(codigos, "reativar"))} className={`${botaoBarra} bg-white/10 hover:bg-white/20`}>
              <Power className="size-4" /> Reativar
            </button>
            <button type="button" disabled={pendente} onClick={() => setJanela("desativar")} className={`${botaoBarra} bg-red-500/20 text-red-200 hover:bg-red-500/30`}>
              <Ban className="size-4" /> Desativar
            </button>
            <a href={exportar("csv")} className={`${botaoBarra} bg-white/10 hover:bg-white/20`}><FileSpreadsheet className="size-4" /> CSV</a>
            <a href={exportar("zip")} className={`${botaoBarra} bg-white/10 hover:bg-white/20`}><FolderArchive className="size-4" /> QR Codes</a>
          </div>
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
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={classeCampo} placeholder="cliente@empresa.com" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setJanela(null)}>Cancelar</Button>
            <Button type="submit" disabled={pendente || !email.trim()}>{pendente && <Loader2 className="animate-spin" />} Confirmar ({selecionadas.size})</Button>
          </div>
        </form>
      </Modal>

      <Modal aberto={janela === "lote"} aoFechar={() => setJanela(null)} titulo="Mover para lote" descricao="As placas selecionadas mudam de lote; nada mais é alterado.">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); executar(() => moverLoteEmMassa(codigos, lote || null)); }}>
          <select value={lote} onChange={(e) => setLote(e.target.value)} className={classeCampo} aria-label="Lote">
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
