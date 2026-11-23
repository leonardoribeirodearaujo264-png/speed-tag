import Link from "next/link";
import { Plus, Search, Tags, Trash2 } from "lucide-react";
import { z } from "zod";
import { CabecalhoPagina, EstadoVazio, Painel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { normalizarCodigo } from "@/lib/codigos";
import { ROTULO_STATUS, formatarData } from "@/lib/placas/rotulos";
import { urlAtivacao } from "@/lib/placas/urls";
import { TabelaPlacas } from "./tabela-placas";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Placas" };

const POR_PAGINA = 50;

const filtros = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  status: z.enum(["disponivel", "reservada", "atribuida", "ativa", "desativada"]).optional().catch(undefined),
  lote: z.union([z.uuid(), z.literal("sem")]).optional().catch(undefined),
  nfc: z.enum(["gravado", "pendente"]).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
  apagada: z.string().max(12).optional().catch(undefined),
});

const classeSelect =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-marca focus:ring-4 focus:ring-marca/15";

export default async function ListaPlacas({ searchParams }: PageProps<"/admin/placas">) {
  const { supabase } = await exigirAdmin("/admin/placas");
  const { apagada, ...f } = filtros.parse(await searchParams);

  const { data: lotes } = await supabase.from("lotes").select("id, nome").order("criado_em", { ascending: false });
  const nomeLote = new Map((lotes ?? []).map((l) => [l.id, l.nome]));

  let consulta = supabase
    .from("placas")
    .select("id, codigo, status, lote_id, empresa_id, nfc_gravado_em, nfc_travado, criado_em", { count: "exact" })
    .order("criado_em", { ascending: false })
    .range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);

  if (f.q) {
    // Busca pelo código ou pelo nome da empresa (cliente).
    const termo = f.q.replace(/[%_,()]/g, " ").trim();
    const { data: achadas } = await supabase.from("empresas").select("id").ilike("nome", `%${termo}%`).limit(200);
    const ids = (achadas ?? []).map((e) => e.id);
    const codigo = normalizarCodigo(termo).replace(/[^A-Z0-9]/g, "");
    const condicoes = [codigo.length >= 2 ? `codigo.ilike.${codigo}%` : "", ids.length ? `empresa_id.in.(${ids.join(",")})` : ""].filter(Boolean);
    consulta = condicoes.length ? consulta.or(condicoes.join(",")) : consulta.eq("codigo", "-");
  }
  if (f.status) consulta = consulta.eq("status", f.status);
  if (f.lote === "sem") consulta = consulta.is("lote_id", null);
  else if (f.lote) consulta = consulta.eq("lote_id", f.lote);
  if (f.nfc === "gravado") consulta = consulta.not("nfc_gravado_em", "is", null);
  if (f.nfc === "pendente") consulta = consulta.is("nfc_gravado_em", null);

  const { data: placas, count, error } = await consulta;

  const empresas = new Map<string, string>();
  const idsEmpresas = [...new Set((placas ?? []).map((p) => p.empresa_id).filter((id): id is string => !!id))];
  if (idsEmpresas.length) {
    const { data } = await supabase.from("empresas").select("id, nome").in("id", idsEmpresas);
    for (const e of data ?? []) empresas.set(e.id, e.nome);
  }

  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const linkPagina = (pagina: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, pagina })) if (v !== undefined) p.set(k, String(v));
    return `/admin/placas?${p}`;
  };

  return (
    <div>
      <CabecalhoPagina
        sobretitulo="Estoque NFC"
        titulo="Placas"
        descricao={`${total.toLocaleString("pt-BR")} ${total === 1 ? "placa" : "placas"} encontradas`}
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

      {apagada && (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <Trash2 className="size-4 text-slate-400" aria-hidden />
          Placa <span className="font-mono font-semibold">{apagada}</span> apagada.
        </div>
      )}

      <Painel>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4" role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              name="q"
              defaultValue={f.q}
              placeholder="Código ou empresa"
              aria-label="Buscar por código ou empresa"
              className="h-10 w-56 rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-marca focus:ring-4 focus:ring-marca/15"
            />
          </div>
          <select name="status" defaultValue={f.status ?? ""} aria-label="Status" className={classeSelect}>
            <option value="">Todos os status</option>
            {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <select name="lote" defaultValue={f.lote ?? ""} aria-label="Lote" className={classeSelect}>
            <option value="">Todos os lotes</option>
            <option value="sem">Sem lote</option>
            {(lotes ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
          <select name="nfc" defaultValue={f.nfc ?? ""} aria-label="NFC" className={classeSelect}>
            <option value="">NFC: todos</option>
            <option value="gravado">NFC gravado</option>
            <option value="pendente">NFC pendente</option>
          </select>
          <button type="submit" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Filtrar
          </button>
        </form>

        {error ? (
          <p role="alert" className="p-6 text-sm text-red-700">
            Não foi possível carregar as placas. Recarregue a página.
          </p>
        ) : !placas?.length ? (
          <EstadoVazio
            icone={Tags}
            titulo="Nenhuma placa encontrada"
            descricao="Toda placa nasce aqui. Crie uma placa ou um lote para gerar código, QR Code e NFC."
            acoes={
              <Link href="/admin/placas/nova" className={buttonVariants()}>
                <Plus aria-hidden /> Criar placa
              </Link>
            }
          />
        ) : (
          <TabelaPlacas
            lotes={lotes ?? []}
            linhas={placas.map((p) => ({
              id: p.id,
              codigo: p.codigo,
              status: p.status,
              empresa: p.empresa_id ? empresas.get(p.empresa_id) ?? null : null,
              lote: p.lote_id ? nomeLote.get(p.lote_id) ?? null : null,
              nfc: p.nfc_travado ? "travado" : p.nfc_gravado_em ? "gravado" : "pendente",
              criadaEm: formatarData(p.criado_em),
              linkAtivacao: urlAtivacao(p.codigo),
            }))}
          />
        )}
      </Painel>

      {paginas > 1 && (
        <nav aria-label="Paginação" className="mt-5 flex items-center justify-center gap-3 text-sm">
          {f.pagina > 1 && <Link href={linkPagina(f.pagina - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Anterior</Link>}
          <span className="text-slate-500">Página {f.pagina} de {paginas}</span>
          {f.pagina < paginas && <Link href={linkPagina(f.pagina + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Próxima</Link>}
        </nav>
      )}
    </div>
  );
}
