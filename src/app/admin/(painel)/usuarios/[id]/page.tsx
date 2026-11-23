import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Tags } from "lucide-react";
import { z } from "zod";
import { CabecalhoPagina, EstadoVazio, Painel, PilulaStatus, TituloPainel } from "@/components/admin/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData } from "@/lib/placas/rotulos";
import { FormUsuario } from "./form-usuario";
import { nomeUsuario } from "@/lib/nome-usuario";
import { TransferirPlaca } from "./transferir-placa";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Usuário" };

export default async function DetalheUsuario({ params, searchParams }: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await params;
  const { criado, ja_existia, cadastro_pendente } = await searchParams;
  const { supabase } = await exigirAdmin(`/admin/usuarios/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const { data: usuario, error } = await supabase
    .from("perfis")
    .select("id, nome, email, telefone, papel, bloqueado_em, limite_placas, criado_em, grupo_cliente")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Falha ao carregar o usuário");
  if (!usuario) notFound();

  const [{ data: placas, count: totalPlacas, error: erroPlacas }, { data: empresas }] = await Promise.all([
    supabase.from("placas").select("id, codigo, status, empresa_id, ativada_em", { count: "exact" }).eq("dono_id", id).order("criado_em", { ascending: false }),
    supabase.from("empresas").select("id, nome").eq("dono_id", id).order("nome"),
  ]);
  const nomeEmpresa = new Map((empresas ?? []).map((e) => [e.id, e.nome]));
  const nome = nomeUsuario(usuario.nome, usuario.email);
  const inicial = nome.charAt(0).toUpperCase();
  const grupo = usuario.papel === "admin" ? "admin" : usuario.grupo_cliente ?? "pendente";

  return (
    <div>
      <Link href={`/admin/usuarios?grupo=${grupo}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Voltar aos clientes
      </Link>
      {cadastro_pendente && (
        <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">A conta existe. Preencha os dados e o tipo de cliente nesta ficha para concluir o cadastro.</p>
      )}

      {(criado || ja_existia) && (
        <div role="status" className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {criado === "novo" && "Conta criada e confirmada. Passe a senha inicial ao cliente e atribua placas pelo e-mail dele."}
          {criado === "existente" && "Este e-mail já tinha conta no login compartilhado; a pessoa foi incluída no app como cliente e a senha dela não mudou."}
          {ja_existia && "Este e-mail já é usuário do app. Nenhuma conta nova foi criada."}
        </div>
      )}

      <CabecalhoPagina
        titulo={
          <span className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-marca to-marca-ciano text-lg font-semibold text-white">
              {inicial}
            </span>
            <span className="min-w-0">
              <span className="block break-words">{nome}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-normal text-slate-500">
                {usuario.email && usuario.email !== nome && <span className="flex min-w-0 items-center gap-1.5 break-all">
                  <Mail className="size-3.5" aria-hidden /> {usuario.email}
                </span>}
                {usuario.telefone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" aria-hidden /> {usuario.telefone}
                  </span>
                )}
                <span>Desde {formatarData(usuario.criado_em)}</span>
              </span>
            </span>
          </span>
        }
        acoes={
          usuario.bloqueado_em ? (
            <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700 ring-1 ring-red-200">Bloqueado</span>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Painel>
          <TituloPainel titulo="Dados e permissões" descricao="Valem só no app de placas. O login da loja não muda." />
          <div className="px-5 pb-6 sm:px-6">
            <FormUsuario
              usuarioId={usuario.id}
              nome={usuario.nome}
              telefone={usuario.telefone}
              limite={usuario.limite_placas}
              bloqueado={!!usuario.bloqueado_em}
              administrador={usuario.papel === "admin"}
              grupo={usuario.grupo_cliente}
            />
          </div>
        </Painel>

        <div className="flex flex-col gap-6">
          <Painel>
            <TituloPainel titulo="Placas vinculadas" descricao={erroPlacas ? "Contagem indisponível" : `${totalPlacas ?? 0} no total`} />
            <TransferirPlaca usuarioId={id} />
            {!placas?.length ? (
              <EstadoVazio icone={Tags} titulo="Nenhuma placa" descricao="Este usuário ainda não tem placas na conta." />
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {placas.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/placas/${p.codigo}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:px-6">
                      <span className="min-w-0">
                        <span className="block font-mono text-sm font-semibold tracking-wider text-slate-900">{p.codigo}</span>
                        <span className="block truncate text-sm text-slate-500">
                          {p.empresa_id ? nomeEmpresa.get(p.empresa_id) ?? "Empresa" : "Sem empresa"}
                        </span>
                      </span>
                      <PilulaStatus status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Painel>

          <Painel>
            <TituloPainel titulo="Empresas" descricao={`${empresas?.length ?? 0} cadastradas`} />
            {!empresas?.length ? (
              <p className="px-5 pb-5 text-sm text-slate-500 sm:px-6">Nenhuma empresa cadastrada.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 px-5 pb-5 sm:px-6">
                {empresas.map((e) => (
                  <li key={e.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                    {e.nome}
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>
      </div>
    </div>
  );
}
