import Link from "next/link";
import { CheckCircle2, Clock, KeyRound, MailWarning, Search, Tags, UserRound } from "lucide-react";
import { z } from "zod";
import { CabecalhoPagina, CartaoIndicador, EstadoVazio, Painel, classeBusca } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { listarCadastros, type Cadastro, type SituacaoCadastro } from "@/lib/admin/cadastros";
import { exigirAdmin } from "@/lib/auth";
import { formatarData } from "@/lib/placas/rotulos";
import { BotaoReenviar } from "./botao-reenviar";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Cadastros" };

const filtros = z.object({
  situacao: z.enum(["todos", "email_pendente", "senha_pendente", "concluido"]).default("todos").catch("todos"),
  q: z.string().trim().max(120).optional().catch(undefined),
});

const SITUACAO: Record<SituacaoCadastro, { rotulo: string; classe: string; icone: typeof Clock }> = {
  email_pendente: { rotulo: "E-mail não confirmado", classe: "bg-amber-50 text-amber-800 ring-amber-200", icone: MailWarning },
  senha_pendente: { rotulo: "Senha não criada", classe: "bg-marca-claro text-marca-texto ring-marca-borda", icone: KeyRound },
  concluido: { rotulo: "Cadastro concluído", classe: "bg-emerald-50 text-emerald-700 ring-emerald-200", icone: CheckCircle2 },
};

const ORIGEM: Record<string, string> = { nfc: "Ativação pelo NFC", site: "Cadastro no site", admin: "Criado pelo ADM" };

function Selo({ situacao }: { situacao: SituacaoCadastro }) {
  const { rotulo, classe, icone: Icone } = SITUACAO[situacao];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${classe}`}>
      <Icone className="size-3.5" aria-hidden /> {rotulo}
    </span>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="text-sm font-medium break-words text-slate-800">{valor || "—"}</dd>
    </div>
  );
}

function CartaoCadastro({ c }: { c: Cadastro }) {
  const pendente = c.situacao !== "concluido";
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{c.nome || c.email}</p>
            {c.nome && <p className="truncate text-sm text-slate-500">{c.email}</p>}
          </div>
        </div>
        <Selo situacao={c.situacao} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Dado rotulo="Cadastro" valor={formatarData(c.criadoEm)} />
        <Dado rotulo="E-mail confirmado" valor={formatarData(c.confirmadoEm)} />
        <Dado rotulo="Último acesso" valor={formatarData(c.ultimoAcesso)} />
        <Dado rotulo="Origem" valor={c.papel === "admin" ? "Administrador" : ORIGEM[c.origem ?? ""] ?? ""} />
      </dl>

      {(c.placas.length > 0 || c.ativacoesPendentes.length > 0) && (
        <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
            <Tags className="size-3.5" aria-hidden /> Placas
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {c.placas.map((p) => (
              <li key={p.codigo} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <Link href={`/admin/placas/${p.codigo}`} className="font-mono font-medium text-marca-texto hover:underline">{p.codigo}</Link>
                <span className="text-slate-500">
                  {p.ativadaEm ? `Ativada em ${formatarData(p.ativadaEm)}` : p.status === "atribuida" ? "Aguardando ativação" : p.status}
                </span>
              </li>
            ))}
            {c.ativacoesPendentes.map((a) => (
              <li key={`${a.codigo}-${a.criadaEm}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span className="font-mono font-medium text-amber-800">{a.codigo}</span>
                <span className="text-amber-800">Pedido em {formatarData(a.criadaEm)} · {a.empresa}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-end">
        {pendente && <BotaoReenviar usuarioId={c.id} />}
        {c.papel && (
          <Link href={`/admin/usuarios/${c.id}`} className={`${buttonVariants({ variant: "ghost" })} min-h-11`}>Abrir ficha</Link>
        )}
      </div>
    </li>
  );
}

export default async function Cadastros({ searchParams }: PageProps<"/admin/cadastros">) {
  await exigirAdmin("/admin/cadastros");
  const f = filtros.parse(await searchParams);

  let cadastros: Cadastro[] = [];
  let falhou = false;
  try {
    cadastros = await listarCadastros();
  } catch (erro) {
    console.error("[admin/cadastros]", erro);
    falhou = true;
  }

  const contagem = { email_pendente: 0, senha_pendente: 0, concluido: 0 };
  for (const c of cadastros) contagem[c.situacao]++;
  const termo = f.q?.toLowerCase();
  const visiveis = cadastros.filter((c) =>
    (f.situacao === "todos" || c.situacao === f.situacao)
    && (!termo || c.email.includes(termo) || (c.nome ?? "").toLowerCase().includes(termo)));

  const link = (situacao: string) => `/admin/cadastros?${new URLSearchParams({ situacao, ...(f.q ? { q: f.q } : {}) })}`;

  return (
    <div>
      <CabecalhoPagina sobretitulo="Gestão" titulo="Cadastros e ativações" descricao="Contas criadas pelo NFC, pelo site e pelo ADM, com a situação de cada uma." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <CartaoIndicador rotulo="Usuários" valor={cadastros.length} icone={UserRound} tom="cinza" />
        <CartaoIndicador rotulo="E-mail pendente" valor={contagem.email_pendente} icone={MailWarning} tom="ambar" />
        <CartaoIndicador rotulo="Senha pendente" valor={contagem.senha_pendente} icone={KeyRound} tom="azul" />
        <CartaoIndicador rotulo="Concluídos" valor={contagem.concluido} icone={CheckCircle2} tom="verde" />
      </div>

      <Painel className="mt-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:p-4">
          <nav aria-label="Situação do cadastro" className="-mx-3 flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-1 [scrollbar-width:none] sm:-mx-4 sm:flex-wrap sm:overflow-visible sm:px-4">
            {([["todos", "Todos"], ["email_pendente", "E-mail pendente"], ["senha_pendente", "Senha pendente"], ["concluido", "Concluídos"]] as const).map(([valor, rotulo]) => (
              <Link key={valor} href={link(valor)} aria-current={f.situacao === valor ? "page" : undefined}
                className={`${buttonVariants({ variant: f.situacao === valor ? "default" : "outline" })} min-h-11 shrink-0 px-3.5 md:min-h-10`}>
                {rotulo}
              </Link>
            ))}
          </nav>
          <form role="search" className="flex gap-2">
            <input type="hidden" name="situacao" value={f.situacao} />
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input name="q" defaultValue={f.q} placeholder="Buscar por nome ou e-mail" aria-label="Buscar por nome ou e-mail" className={classeBusca} />
            </div>
            <button type="submit" className={`${buttonVariants({ variant: "outline" })} min-h-11 px-4`}>Buscar</button>
          </form>
        </div>

        {falhou ? (
          <p role="alert" className="p-6 text-sm text-red-700">Não foi possível carregar os cadastros. Recarregue a página.</p>
        ) : visiveis.length === 0 ? (
          <EstadoVazio icone={UserRound} titulo="Nenhum cadastro encontrado" descricao="Ajuste a busca ou o filtro." />
        ) : (
          <ul className="grid gap-3 bg-slate-50 p-3 sm:p-4 xl:grid-cols-2">
            {visiveis.map((c) => <CartaoCadastro key={c.id} c={c} />)}
          </ul>
        )}
      </Painel>
    </div>
  );
}
