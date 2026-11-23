import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, Nfc } from "lucide-react";
import { CabecalhoPagina, Painel } from "@/components/admin/ui";
import { nomeUsuario } from "@/lib/nome-usuario";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { PaginaCliente } from "../menu-cliente";

export const instant = false;
export const metadata = { title: "Início do cliente" };

export default async function InicioCliente() {
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?proximo=/painel/inicio");

  const [{ data: perfil, error }, empresas, placas] = await Promise.all([
    supabase.from("perfis").select("nome, bloqueado_em").eq("id", user.id).maybeSingle(),
    supabase.from("empresas").select("id", { count: "exact", head: true }).eq("dono_id", user.id),
    supabase.from("placas").select("id", { count: "exact", head: true }).eq("dono_id", user.id),
  ]);
  if (error) throw new Error("Falha ao consultar o perfil");
  if (perfil?.bloqueado_em) redirect("/painel");

  const destinos = [
    { href: "/painel/empresas", titulo: "Empresas", Icone: Building2, resultado: empresas },
    { href: "/painel", titulo: "Placas", Icone: Nfc, resultado: placas },
  ];
  return (
    <PaginaCliente nome={nomeUsuario(perfil?.nome, user.email)} secao="inicio">
      <CabecalhoPagina titulo="Início" />
      <div className="grid gap-3 sm:grid-cols-2">
        {destinos.map(({ href, titulo, Icone, resultado }) => (
          <Link key={href} href={href} className="rounded-2xl focus-visible:ring-2 focus-visible:ring-marca">
            <Painel className="flex min-h-20 items-center gap-4 p-4 transition-colors hover:border-marca-borda active:bg-slate-50 sm:p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-claro text-marca-texto">
                <Icone className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900">{titulo}</h2>
                <p className="text-sm text-slate-600">{resultado.error ? "Contagem indisponível" : `${resultado.count ?? 0} na conta`}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
            </Painel>
          </Link>
        ))}
      </div>
    </PaginaCliente>
  );
}
