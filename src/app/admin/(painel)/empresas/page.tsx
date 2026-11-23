import { Suspense } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Nfc, Search, UserRound } from "lucide-react";
import { CabecalhoPagina, Painel } from "@/components/admin/ui";
import { CartaoListagem } from "@/components/admin/cartao-listagem";
import { buttonVariants } from "@/components/ui/button";
import { exigirAdmin } from "@/lib/auth";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { FormEmpresa } from "@/components/placa/form-empresa";
import { EditarNomeEmpresa } from "@/components/placa/editar-nome-empresa";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";

const TAMANHO = 25;

async function Empresas({ searchParams }: { searchParams: PageProps<"/admin/empresas">["searchParams"] }) {
  const [{ supabase }, filtros] = await Promise.all([exigirAdmin("/admin/empresas"), searchParams]);
  const busca = typeof filtros.q === "string" ? filtros.q.trim().slice(0, 80) : "";
  const entrada = Number(filtros.pagina);
  const pagina = Number.isInteger(entrada) && entrada > 0 && entrada < 100000 ? entrada : 1;
  let consulta = supabase.from("empresas").select("*", { count: "exact" });
  if (busca) consulta = consulta.ilike("nome", `%${busca.replace(/[\\%_]/g, "\\$&")}%`);
  const [{ data, error, count }, cadastro] = await Promise.all([
    consulta.order("nome").order("id").range((pagina - 1) * TAMANHO, pagina * TAMANHO - 1),
    supabase.from("empresas").select("email_contato").limit(0),
  ]);
  const cadastroDisponivel = !cadastro.error;
  const paginaUrl = (numero: number) => `?q=${encodeURIComponent(busca)}&pagina=${numero}`;

  return (
    <>
      <CabecalhoPagina titulo="Empresas" descricao={`${count ?? 0} empresas encontradas`} acoes={
        cadastroDisponivel && <DialogoEmpresa tipo="criar" botao="Criar nova empresa"><FormEmpresa admin /></DialogoEmpresa>
      } />
      {!cadastroDisponivel && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O cadastro manual de empresas depende da atualização do banco de dados.</p>}
      <form role="search" className="mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-40 flex-1 sm:max-w-md">
          <Search className="absolute top-3 left-3 size-4 text-slate-500" aria-hidden />
          <input name="q" type="search" defaultValue={busca} maxLength={80} aria-label="Nome da empresa" placeholder="Buscar empresa" className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm" />
        </div>
        <button type="submit" className={buttonVariants({ className: "h-10" })}>Buscar</button>
        {busca && <Link href="/admin/empresas" className={buttonVariants({ variant: "outline", className: "h-10" })}>Limpar</Link>}
      </form>
      {error ? (
        <Painel><p role="alert" className="p-5">Não foi possível carregar as empresas.</p></Painel>
      ) : !data?.length ? (
        <Painel><p className="p-5">Nenhuma empresa encontrada.</p></Painel>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.map((empresa) => (
            <li key={empresa.id} className="min-w-0">
              <CartaoListagem
                icone={<Building2 className="size-5" aria-hidden />}
                titulo={empresa.nome}
                subtitulo={empresa.email_contato ?? (empresa.dono_id ? "Empresa vinculada a cliente" : "Sem titular vinculado")}
                opcoes={null}
                acoes={<>
                  <Link href={`/admin/placas?empresa=${empresa.id}`} className={buttonVariants({ variant: "outline", className: "min-h-11 grow" })}>
                    <Nfc aria-hidden /> Ver placas
                  </Link>
                  {linkGooglePermitido(empresa.link_avaliacao) && (
                    <a href={empresa.link_avaliacao} target="_blank" rel="noreferrer" className={buttonVariants({ className: "min-h-11 grow" })}>
                      <ExternalLink aria-hidden /> Abrir avaliação
                    </a>
                  )}
                </>}
              >
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <DialogoEmpresa tipo="editar" botao="Editar dados" titulo={`Editar ${empresa.nome}`}>
                    {cadastroDisponivel
                      ? <FormEmpresa id={empresa.id} nome={empresa.nome} email={empresa.email_contato ?? ""} temLink={Boolean(empresa.link_avaliacao)} admin />
                      : <EditarNomeEmpresa id={empresa.id} nome={empresa.nome} />}
                  </DialogoEmpresa>
                  {empresa.dono_id && (
                    <Link href={`/admin/usuarios/${empresa.dono_id}`} className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
                      <UserRound aria-hidden /> Ver titular
                    </Link>
                  )}
                </div>
              </CartaoListagem>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Paginação" className="mt-4 flex gap-4 text-sm text-marca-texto">
        {pagina > 1 && <Link href={paginaUrl(pagina - 1)}>Anterior</Link>}
        {pagina * TAMANHO < (count ?? 0) && <Link href={paginaUrl(pagina + 1)}>Próxima</Link>}
      </nav>
    </>
  );
}

export default function PaginaEmpresas({ searchParams }: PageProps<"/admin/empresas">) {
  return <Suspense fallback={<p>Carregando empresas...</p>}><Empresas searchParams={searchParams} /></Suspense>;
}
