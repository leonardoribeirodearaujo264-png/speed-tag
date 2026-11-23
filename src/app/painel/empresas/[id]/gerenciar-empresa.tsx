import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, Nfc } from "lucide-react";
import { z } from "zod";
import { CabecalhoPagina, Painel, PilulaStatus } from "@/components/admin/ui";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { EditarNomeEmpresa } from "@/components/placa/editar-nome-empresa";
import { FormEmpresa } from "@/components/placa/form-empresa";
import { buttonVariants } from "@/components/ui/button";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { exigirAdmin } from "@/lib/auth";
import { nomeUsuario } from "@/lib/nome-usuario";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { PaginaCliente } from "../../menu-cliente";
import { AdicionarPlacaComprada } from "../../registrar-placa";
import { FormRemoverPlaca } from "../form-remover-placa";
import { FormVincularPlaca } from "../form-vincular-placa";

const POR_PAGINA = 20;
const filtros = z.object({ pagina: z.coerce.number().int().min(1).max(1000).default(1).catch(1) });

export async function GerenciarEmpresa({ id, busca, admin = false }: {
  id: string;
  busca: Record<string, string | string[] | undefined>;
  admin?: boolean;
}) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { pagina } = filtros.parse(busca);
  const lista = admin ? "/admin/empresas" : "/painel/empresas";
  const caminho = `${lista}/${id}`;
  const sessaoAdmin = admin ? await exigirAdmin(caminho) : null;
  const supabase = sessaoAdmin?.supabase ?? await clienteSupabaseUsuario();
  const user = sessaoAdmin
    ? { id: sessaoAdmin.usuarioId, email: sessaoAdmin.email }
    : (await supabase.auth.getUser()).data.user;
  if (!user) redirect(`/entrar?proximo=${encodeURIComponent(caminho)}`);

  let consultaEmpresa = supabase.from("empresas").select("*").eq("id", id);
  let consultaPlacas = supabase.from("placas").select("codigo, status", { count: "exact" }).eq("empresa_id", id);
  if (!admin) {
    consultaEmpresa = consultaEmpresa.eq("dono_id", user.id);
    consultaPlacas = consultaPlacas.eq("dono_id", user.id);
  }

  const [perfil, empresa, placas] = await Promise.all([
    admin ? null : supabase.from("perfis").select("nome, bloqueado_em").eq("id", user.id).maybeSingle(),
    consultaEmpresa.maybeSingle(),
    consultaPlacas.order("codigo").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
  ]);
  if (perfil?.error || empresa.error) throw new Error("Falha ao carregar a empresa");
  if (perfil?.data?.bloqueado_em) redirect("/painel");
  if (!empresa.data) notFound();

  const dados = empresa.data;
  const temCadastro = Object.hasOwn(dados, "email_contato");
  const temAvaliacao = linkGooglePermitido(dados.link_avaliacao);
  const paginas = Math.ceil((placas.count ?? 0) / POR_PAGINA);

  const conteudo = (
    <>
      <Link href={lista} className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-marca-texto hover:underline sm:min-h-9">
        <ArrowLeft className="size-4" aria-hidden /> {admin ? "Empresas" : "Minhas empresas"}
      </Link>
      <CabecalhoPagina titulo={<span className="break-words">{dados.nome}</span>} />
      <Painel className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Dados e link de avaliação</h2>
          {temAvaliacao && <a href={dados.link_avaliacao} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", className: "min-h-11 w-full px-4 sm:min-h-9 sm:w-auto" })}><ExternalLink aria-hidden /> Abrir avaliação</a>}
        </div>
        {temCadastro ? <FormEmpresa id={id} nome={dados.nome} email={dados.email_contato ?? (admin ? "" : user.email ?? "")} admin={admin} linkAtual={dados.link_avaliacao} />
          : <EditarNomeEmpresa id={id} nome={dados.nome} />}
      </Painel>
      <Painel className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Nfc className="size-5 text-marca-texto" aria-hidden /> Placas vinculadas</h2>
            {!placas.error && <p className="mt-1 text-sm text-slate-600">{placas.count ?? 0} no total</p>}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {admin ? (
              <DialogoEmpresa tipo="placa" botao="Adicionar placa" abertoInicial={busca.adicionar === "1"}
                descricao="Digite o código de uma placa em estoque ou de uma placa já atribuída ao titular.">
                {temCadastro && temAvaliacao ? <FormVincularPlaca empresa={id} admin />
                  : <p className="text-sm text-slate-600">Salve o link de avaliação da empresa antes de vincular uma placa.</p>}
              </DialogoEmpresa>
            ) : (
              <>
                <AdicionarPlacaComprada empresa={id} codigoInvalido={busca.erro === "codigo"} />
                {temCadastro && temAvaliacao && (
                  <DialogoEmpresa tipo="placa" botao="Vincular placa da conta">
                    <FormVincularPlaca empresa={id} />
                  </DialogoEmpresa>
                )}
              </>
            )}
          </div>
        </div>
        {placas.error ? <p role="alert" className="text-sm text-red-700">Não foi possível carregar as placas.</p>
          : !placas.data.length ? <p className="text-sm text-slate-600">Nenhuma placa nesta página.</p>
          : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {placas.data.map((placa) => (
                <li key={placa.codigo} className="flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{placa.codigo}</span>
                    <PilulaStatus status={placa.status} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 md:flex md:flex-wrap">
                    <a href={admin ? `/api/admin/placas/${placa.codigo}/qr?formato=png&baixar=1` : `/painel/qr/${placa.codigo}`} className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
                      <Download aria-hidden /> Baixar QR Code
                    </a>
                    <DialogoEmpresa tipo="remover" botao="Remover da empresa" titulo={`Remover placa ${placa.codigo}`}
                      descricao="A placa continua na sua conta e pode ser vinculada novamente.">
                      <FormRemoverPlaca empresa={id} codigo={placa.codigo} />
                    </DialogoEmpresa>
                  </div>
                </li>
              ))}
            </ul>
          )}
        {paginas > 1 && <nav aria-label="Páginas de placas" className="flex flex-wrap items-center justify-between gap-2 text-sm sm:justify-start">
          {pagina > 1 && <Link href={`${caminho}?pagina=${pagina - 1}`} className={buttonVariants({ variant: "outline", className: "min-h-11 px-4 sm:min-h-9" })}>Anterior</Link>}
          <span className="order-first w-full text-center text-slate-600 sm:order-none sm:w-auto">Página {pagina} de {paginas}</span>
          {pagina < paginas && <Link href={`${caminho}?pagina=${pagina + 1}`} className={buttonVariants({ variant: "outline", className: "ml-auto min-h-11 px-4 sm:ml-0 sm:min-h-9" })}>Próxima</Link>}
        </nav>}
      </Painel>
    </>
  );

  if (admin) return <div className="space-y-4">{conteudo}</div>;
  return (
    <PaginaCliente nome={nomeUsuario(perfil?.data?.nome, user.email)} secao="empresas" className="space-y-4">
      {conteudo}
    </PaginaCliente>
  );
}
