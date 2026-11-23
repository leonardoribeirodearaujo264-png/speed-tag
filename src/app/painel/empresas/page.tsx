import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2, ExternalLink, Link2, Nfc, Pencil, UserRound } from "lucide-react";
import { CartaoListagem } from "@/components/admin/cartao-listagem";
import { EstadoVazio, Painel } from "@/components/admin/ui";
import { FormEmpresa } from "@/components/placa/form-empresa";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { buttonVariants } from "@/components/ui/button";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { codigoValido } from "@/lib/codigos";
import { nomeUsuario } from "@/lib/nome-usuario";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { PaginaCliente } from "../menu-cliente";
import { FormDefinirSenha } from "./form-definir-senha";
import { FormPerfil } from "./form-perfil";
import { FormPlacaComprada } from "../form-placa-comprada";
import { PlacaPendente } from "./placa-pendente";

export const instant = false;
export const metadata = { title: "Minhas empresas" };

export default async function EmpresasCliente({ searchParams }: PageProps<"/painel/empresas">) {
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?proximo=/painel/empresas");

  const { ativada, erro, placa, empresa } = await searchParams;
  const placaPendente = typeof placa === "string" && codigoValido(placa) ? placa : null;
  const codigo = typeof ativada === "string" && codigoValido(ativada) ? ativada : null;
  const [{ data: perfil, error: erroPerfil }, { data: empresas, error }, confirmacao, cadastro] = await Promise.all([
    supabase.from("perfis").select("nome, bloqueado_em").eq("id", user.id).maybeSingle(),
    supabase.from("empresas").select("*").eq("dono_id", user.id).order("nome").order("id"),
    codigo ? supabase.from("placas").select("codigo").eq("codigo", codigo).eq("dono_id", user.id).eq("status", "ativa").maybeSingle() : null,
    supabase.from("empresas").select("email_contato").limit(0),
  ]);
  const cadastroDisponivel = !cadastro.error;
  if (erroPerfil) throw new Error("Falha ao consultar o perfil");
  if (perfil?.bloqueado_em) redirect("/painel");

  return (
    <PaginaCliente nome={nomeUsuario(perfil?.nome, user.email)} secao="empresas">
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-fundo text-marca-ciano"><Building2 className="size-5" aria-hidden /></span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Minhas empresas</h1>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {cadastroDisponivel && <DialogoEmpresa tipo="criar" botao="Criar nova empresa" descricao="Informe os dados do estabelecimento para cadastrá-lo na sua conta.">
            <FormEmpresa email={user.email ?? ""} />
          </DialogoEmpresa>}
          <DialogoEmpresa tipo="placa" botao="Ativar placa comprada" abertoInicial={erro === "codigo"}
            descricao="Informe o código que está impresso na placa que você comprou.">
            <FormPlacaComprada empresas />
            {erro === "codigo" && <p role="alert" className="mt-2 text-sm text-red-700">Confira o código impresso na placa.</p>}
          </DialogoEmpresa>
        </div>
      </section>
      {placaPendente && (
        <PlacaPendente codigo={placaPendente} idUsuario={user.id} email={user.email ?? ""} empresas={cadastroDisponivel ? empresas ?? [] : []}
          empresaPreferida={typeof empresa === "string" ? empresa : undefined} />
      )}
      {!cadastroDisponivel && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O cadastro manual de empresas está temporariamente indisponível. Você pode selecionar a empresa pelo Google ao ativar uma placa.</p>}
      {confirmacao?.data && (
        <p role="status" className="mb-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          Placa {confirmacao.data.codigo} ativada. Agora ela abre a avaliação da empresa.
        </p>
      )}
      {error ? (
        <Painel><p role="alert" className="p-4">Não foi possível carregar as suas empresas.</p></Painel>
      ) : !empresas.length ? (
        <Painel><EstadoVazio icone={Building2} titulo="Nenhuma empresa cadastrada" descricao={cadastroDisponivel ? "Crie uma empresa ou selecione um estabelecimento ao ativar a sua placa." : "Selecione um estabelecimento ao ativar a sua placa."} /></Painel>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {empresas.map((empresa) => {
            const temAvaliacao = linkGooglePermitido(empresa.link_avaliacao);
            return (
              <li key={empresa.id} className="min-w-0">
                <CartaoListagem
                  icone={<Building2 className="size-5" aria-hidden />}
                  titulo={empresa.nome}
                  subtitulo={empresa.email_contato ?? "E-mail de contato pendente"}
                  opcoes={null}
                  acoes={<>
                    <Link href={`/painel?empresa=${empresa.id}#minhas-placas`} className={buttonVariants({ variant: "outline", className: "min-h-11 grow" })}><Nfc aria-hidden /> Ver placas</Link>
                    {temAvaliacao && <a href={empresa.link_avaliacao} target="_blank" rel="noreferrer" className={buttonVariants({ className: "min-h-11 grow" })}><ExternalLink aria-hidden /> Abrir avaliação</a>}
                  </>}
                >
                  {cadastroDisponivel && !temAvaliacao && <p className="flex items-center gap-2 text-sm text-amber-800"><Link2 className="size-4 shrink-0" aria-hidden /> Adicione o link do Google para vincular placas.</p>}
                  <div className="grid gap-2 sm:flex sm:flex-wrap">
                    <Link href={`/painel/empresas/${empresa.id}`} className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
                      <Pencil aria-hidden /> Editar empresa
                    </Link>
                  </div>
                </CartaoListagem>
              </li>
            );
          })}
        </ul>
      )}
      <section id="perfil" aria-label="Meu perfil" className="mt-5 scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><UserRound className="size-5 text-marca-texto" aria-hidden /> Meu perfil</h2>
        <FormPerfil nome={perfil?.nome ?? ""} email={user.email ?? ""} />
        <div className="mt-4 border-t pt-4">
          <DialogoEmpresa tipo="senha" botao="Alterar senha de acesso">
            <FormDefinirSenha />
          </DialogoEmpresa>
        </div>
      </section>
    </PaginaCliente>
  );
}
