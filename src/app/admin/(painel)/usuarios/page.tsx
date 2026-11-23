import Link from "next/link";
import { Ellipsis, Pencil, Search, UserPlus, Users } from "lucide-react";
import { z } from "zod";
import { CabecalhoPagina, EstadoVazio, Painel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { CartaoListagem } from "@/components/admin/cartao-listagem";
import { RemoverAcesso } from "./[id]/remover-acesso";
import { nomeUsuario } from "@/lib/nome-usuario";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Usuários" };

const POR_PAGINA = 40;

const filtros = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  grupo: z.enum(["revendedor", "comprador", "pendente", "admin"]).default("revendedor").catch("revendedor"),
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
    .select("id, nome, email, papel, bloqueado_em, grupo_cliente", { count: "exact" })
    .order("criado_em", { ascending: false })
    .range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);

  if (f.q) {
    // Valor entre aspas no filtro do PostgREST; tira os caracteres que quebrariam a sintaxe.
    const termo = f.q.replace(/[%,()"\\*]/g, " ").trim();
    if (termo) consulta = consulta.or(`nome.ilike."%${termo}%",email.ilike."%${termo}%"`);
  }
  if (f.grupo === "admin") consulta = consulta.eq("papel", "admin");
  else {
    consulta = consulta.eq("papel", "cliente");
    consulta = f.grupo === "pendente" ? consulta.is("grupo_cliente", null) : consulta.eq("grupo_cliente", f.grupo);
  }
  if (f.situacao === "bloqueados") consulta = consulta.not("bloqueado_em", "is", null);
  if (f.situacao === "ativos") consulta = consulta.is("bloqueado_em", null);

  const { data: usuarios, count, error } = await consulta;

  const contagem = new Map<string, number>();
  const ids = (usuarios ?? []).map((u) => u.id);
  const quantidade = ids.length ? await supabase.rpc("speed_tag_contar_placas_clientes", { p_usuarios: ids }) : null;
  for (const registro of quantidade?.data ?? []) contagem.set(registro.usuario_id, registro.total);

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
        titulo={f.grupo === "comprador" ? "Compradores de placas" : "Gestão de Clientes"}
        descricao={`${total.toLocaleString("pt-BR")} ${total === 1 ? "conta encontrada" : "contas encontradas"}`}
        acoes={
          <Link href={`/admin/usuarios/novo?grupo=${f.grupo === "comprador" ? "comprador" : "revendedor"}`} className={buttonVariants({ size: "lg" })}>
            <UserPlus aria-hidden /> Criar conta de cliente
          </Link>
        }
      />

      <nav aria-label="Tipos de conta" className="mb-4 flex flex-wrap gap-2">
        {([
          ["revendedor", "Revendedores"],
          ["comprador", "Compradores de placas"],
          ["pendente", "A classificar"],
          ["admin", "Administradores"],
        ] as const).map(([grupo, rotulo]) => (
          <Link key={grupo} href={`/admin/usuarios?grupo=${grupo}`} aria-current={f.grupo === grupo ? "page" : undefined}
            className={buttonVariants({ variant: f.grupo === grupo ? "default" : "outline" })}>{rotulo}</Link>
        ))}
        <Link href="/admin/placas" className={buttonVariants({ variant: "outline" })}>Estoque de placas</Link>
      </nav>
      <Painel>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4" role="search">
          <input type="hidden" name="grupo" value={f.grupo} />
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
          <ul className="grid gap-3 bg-slate-50 p-4 lg:grid-cols-2">
            {usuarios.map((usuario) => {
              const ficha = `/admin/usuarios/${usuario.id}`;
              const placas = contagem.get(usuario.id) ?? 0;
              const nome = nomeUsuario(usuario.nome, usuario.email);
              return (
                <li key={usuario.id} className="min-w-0">
                  <CartaoListagem
                    icone={<Users className="size-5" aria-hidden />}
                    titulo={<Link href={ficha} className="hover:underline">{nome}</Link>}
                    subtitulo={nome !== usuario.email ? usuario.email : null}
                    opcoes={usuario.papel === "cliente" && !usuario.bloqueado_em && (
                      <details className="relative">
                        <summary aria-label={`Opções de ${usuario.nome ?? usuario.email ?? "cliente"}`} className="grid size-9 cursor-pointer list-none place-items-center rounded-lg hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                          <Ellipsis className="size-5" aria-hidden />
                        </summary>
                        <div className="absolute top-full right-0 z-10 w-56 rounded-xl border bg-white p-3 shadow-lg">
                          <Link href={ficha} className="text-sm font-medium text-marca-texto hover:underline">Editar cadastro</Link>
                          <RemoverAcesso usuarioId={usuario.id} />
                        </div>
                      </details>
                    )}
                    acoes={<Link href={ficha} className={buttonVariants({ variant: "outline" })}><Pencil aria-hidden /> Editar</Link>}
                  >
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="font-medium text-slate-700">{quantidade?.error ? "Contagem indisponível" : `${placas} ${placas === 1 ? "placa" : "placas"}`}</span>
                      <span className={usuario.bloqueado_em ? "text-red-700" : "text-emerald-700"}>{usuario.bloqueado_em ? "Acesso bloqueado" : "Com acesso"}</span>
                    </div>
                  </CartaoListagem>
                </li>
              );
            })}
          </ul>
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
