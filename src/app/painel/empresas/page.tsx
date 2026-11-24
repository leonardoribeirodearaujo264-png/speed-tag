import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Eye } from "lucide-react";
import { z } from "zod";
import { FormEmpresa } from "@/components/placa/form-empresa";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { codigoValido } from "@/lib/codigos";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { PaginaCliente } from "../menu-cliente";
import { PlacaPendente } from "./placa-pendente";
import { EditarLinkEmpresa, OpcoesEmpresa } from "./acoes-cartao";

export const instant = false;
export const metadata = { title: "Minhas empresas" };

const POR_PAGINA = 8;
const paginaValida = z.coerce.number().int().min(1).max(100000).catch(1);
const botaoPagina = "grid size-11 place-items-center rounded-xl border border-slate-600 text-slate-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300";

function MarcaGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="size-6 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 31 14.3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5Z" />
      <path fill="#EA4335" d="M6.3 14.7 13 20A12 12 0 0 1 31 14.3l5.7-5.7a20 20 0 0 0-30.4 6.1Z" />
      <path fill="#FBBC05" d="M6.3 14.7a20 20 0 0 0 0 18.6l6.7-5.2a12 12 0 0 1 0-8.1Z" />
      <path fill="#34A853" d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2a12 12 0 0 1-18.2-5.5l-6.7 5.2A20 20 0 0 0 24 44Z" />
    </svg>
  );
}

export default async function EmpresasCliente({ searchParams }: PageProps<"/painel/empresas">) {
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?proximo=/painel/empresas");

  const filtros = await searchParams;
  const pagina = paginaValida.parse(filtros.pagina);
  const placa = typeof filtros.placa === "string" && codigoValido(filtros.placa) ? filtros.placa : null;
  const ativada = typeof filtros.ativada === "string" && codigoValido(filtros.ativada) ? filtros.ativada : null;
  const consulta = supabase.from("empresas").select("id, nome, link_avaliacao", { count: "exact" })
    .eq("dono_id", user.id).order("nome").order("id").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  const [acesso, empresas, confirmacao, empresasAtivacao] = await Promise.all([
    supabase.rpc("speed_tag_acesso_cliente"),
    consulta,
    ativada ? supabase.from("placas").select("codigo").eq("codigo", ativada).eq("dono_id", user.id).eq("status", "ativa").maybeSingle() : null,
    placa ? supabase.from("empresas").select("id, nome, link_avaliacao").eq("dono_id", user.id).order("nome") : null,
  ]);
  if (acesso.error || !acesso.data) return <PaginaCliente><p role="alert">Seu acesso está indisponível.</p></PaginaCliente>;

  const paginas = Math.max(1, Math.ceil((empresas.count ?? 0) / POR_PAGINA));
  if (!empresas.error && pagina > paginas && !placa) redirect(`/painel/empresas?pagina=${paginas}`);
  const ids = empresas.data?.map(({ id }) => id) ?? [];
  const acessos = ids.length ? await supabase.rpc("speed_tag_acessos_empresas", { p_empresas: ids }) : null;
  const contagens = new Map(acessos?.data?.map(({ empresa_id, acessos }) => [empresa_id, acessos]));

  return (
    <PaginaCliente>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Minhas empresas</h1>
        <DialogoEmpresa tipo="criar" botao="Nova empresa">
          <FormEmpresa email={user.email ?? ""} />
        </DialogoEmpresa>
      </div>
      {placa && (
        <PlacaPendente codigo={placa} idUsuario={user.id} email={user.email ?? ""} empresas={empresasAtivacao?.data ?? []}
          empresaPreferida={typeof filtros.empresa === "string" ? filtros.empresa : undefined} />
      )}
      {confirmacao?.data && <p role="status" className="mb-4 rounded-xl bg-emerald-950 px-4 py-3 text-sm text-emerald-200">Placa ativada. Ela já abre a avaliação no Google.</p>}
      {empresas.error ? <p role="alert">Não foi possível carregar suas empresas.</p> : !empresas.data.length ? (
        <p className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-300">Nenhuma empresa cadastrada.</p>
      ) : (
        <ul className="grid gap-3">
          {empresas.data.map(({ id, nome, link_avaliacao: link }) => (
            <li key={id} className="min-w-0 rounded-2xl border border-slate-700 bg-slate-900 p-3.5 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="flex min-w-0 items-start gap-2.5 text-lg font-semibold"><MarcaGoogle /><span className="min-w-0 wrap-anywhere">{nome}</span></h2>
                <OpcoesEmpresa id={id} nome={nome} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-sm tabular-nums text-slate-300">
                  <Eye className="size-4 shrink-0" aria-hidden />
                  {acessos?.error ? (
                    <span><span aria-hidden>—</span><span className="sr-only">Acessos indisponíveis</span></span>
                  ) : (
                    <span>{(contagens.get(id) ?? 0).toLocaleString("pt-BR")}<span className="sr-only"> acessos</span></span>
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <EditarLinkEmpresa id={id} link={link} />
                  {linkGooglePermitido(link) && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-marca px-3 text-sm font-semibold hover:bg-marca-forte focus-visible:ring-2 focus-visible:ring-cyan-300">
                      <ExternalLink className="size-4" aria-hidden /> Abrir
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {paginas > 1 && (
        <nav aria-label="Páginas de empresas" className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
          {pagina > 1 ? <Link href={`?pagina=${pagina - 1}`} aria-label="Página anterior" className={botaoPagina}><ChevronLeft aria-hidden /></Link> : <span aria-hidden className="size-11" />}
          <span className="min-w-16 text-center font-medium tabular-nums" aria-current="page">{pagina} de {paginas}</span>
          {pagina < paginas ? <Link href={`?pagina=${pagina + 1}`} aria-label="Próxima página" className={botaoPagina}><ChevronRight aria-hidden /></Link> : <span aria-hidden className="size-11" />}
        </nav>
      )}
    </PaginaCliente>
  );
}
