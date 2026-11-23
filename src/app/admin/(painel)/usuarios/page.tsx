import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";
import { z } from "zod";
import { CabecalhoPagina, EstadoVazio, Painel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { formatarData } from "@/lib/placas/rotulos";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Usuários" };

const POR_PAGINA = 40;

const filtros = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  papel: z.enum(["cliente", "admin"]).optional().catch(undefined),
  situacao: z.enum(["ativos", "bloqueados"]).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

const classeSelect =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-marca focus:ring-4 focus:ring-marca/15";

export default async function ListaUsuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  const { supabase } = await exigirAdmin("/admin/usuarios");
  const f = filtros.parse(await searchParams);

  let consulta = supabase
    .from("perfis")
    .select("id, nome, email, telefone, papel, bloqueado_em, criado_em", { count: "exact" })
    .order("criado_em", { ascending: false })
    .range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);

  if (f.q) {
    // Valor entre aspas no filtro do PostgREST; tira os caracteres que quebrariam a sintaxe.
    const termo = f.q.replace(/[%,()"\\*]/g, " ").trim();
    if (termo) consulta = consulta.or(`nome.ilike."%${termo}%",email.ilike."%${termo}%"`);
  }
  if (f.papel) consulta = consulta.eq("papel", f.papel);
  if (f.situacao === "bloqueados") consulta = consulta.not("bloqueado_em", "is", null);
  if (f.situacao === "ativos") consulta = consulta.is("bloqueado_em", null);

  const { data: usuarios, count, error } = await consulta;

  const contagem = new Map<string, number>();
  const ids = (usuarios ?? []).map((u) => u.id);
  if (ids.length) {
    const { data } = await supabase.from("placas").select("dono_id").in("dono_id", ids);
    for (const p of data ?? []) if (p.dono_id) contagem.set(p.dono_id, (contagem.get(p.dono_id) ?? 0) + 1);
  }

  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const linkPagina = (pagina: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, pagina })) if (v !== undefined) p.set(k, String(v));
    return `/admin/usuarios?${p}`;
  };

  return (
    <div>
      <CabecalhoPagina
        sobretitulo="Gestão"
        titulo="Usuários"
        descricao="Clientes e administradores do app de placas. As mudanças valem só dentro deste painel."
        acoes={
          <Link href="/admin/usuarios/novo" className={buttonVariants({ size: "lg" })}>
            <UserPlus aria-hidden /> Criar conta de cliente
          </Link>
        }
      />

      <Painel>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4" role="search">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              name="q"
              defaultValue={f.q}
              placeholder="Buscar por nome ou e-mail"
              aria-label="Buscar por nome ou e-mail"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-marca focus:ring-4 focus:ring-marca/15"
            />
          </div>
          <select name="papel" defaultValue={f.papel ?? ""} aria-label="Papel" className={classeSelect}>
            <option value="">Todos os papéis</option>
            <option value="cliente">Clientes</option>
            <option value="admin">Administradores</option>
          </select>
          <select name="situacao" defaultValue={f.situacao ?? ""} aria-label="Situação" className={classeSelect}>
            <option value="">Todas as situações</option>
            <option value="ativos">Com acesso</option>
            <option value="bloqueados">Bloqueados</option>
          </select>
          <button type="submit" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Filtrar
          </button>
        </form>

        {error ? (
          <p role="alert" className="p-6 text-sm text-red-700">
            Não foi possível carregar os usuários. Recarregue a página.
          </p>
        ) : !usuarios?.length ? (
          <EstadoVazio icone={Users} titulo="Nenhum usuário encontrado" descricao="Ajuste a busca ou os filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 font-medium">Usuário</th>
                  <th className="px-5 py-3 font-medium">Papel</th>
                  <th className="px-5 py-3 text-right font-medium">Placas</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Situação</th>
                  <th className="hidden px-5 py-3 font-medium lg:table-cell">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map((u) => {
                  const inicial = (u.nome ?? u.email ?? "?").trim().charAt(0).toUpperCase();
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <Link href={`/admin/usuarios/${u.id}`} className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marca-claro text-sm font-semibold text-marca-texto ring-1 ring-marca-borda">
                            {inicial}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900 hover:underline">{u.nome ?? "Sem nome"}</span>
                            <span className="block truncate text-slate-500">{u.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        {u.papel === "admin" ? (
                          <span className="rounded-full bg-marca-claro px-2.5 py-0.5 text-xs font-medium text-marca-texto ring-1 ring-marca-borda">Admin</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">Cliente</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700 tabular-nums">{contagem.get(u.id) ?? 0}</td>
                      <td className="hidden px-5 py-3 md:table-cell">
                        {u.bloqueado_em ? (
                          <span className="text-xs font-medium text-red-600">Bloqueado</span>
                        ) : (
                          <span className="text-xs text-emerald-600">Com acesso</span>
                        )}
                      </td>
                      <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">{formatarData(u.criado_em)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
