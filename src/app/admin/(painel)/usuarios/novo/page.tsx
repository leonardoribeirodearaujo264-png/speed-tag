import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CabecalhoPagina, Painel } from "@/components/admin/ui";
import { exigirAdmin } from "@/lib/auth";
import { FormNovoUsuario } from "./form-novo-usuario";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Criar conta de cliente" };

export default async function NovoUsuario({ searchParams }: PageProps<"/admin/usuarios/novo">) {
  const [, filtros] = await Promise.all([exigirAdmin("/admin/usuarios/novo"), searchParams]);
  const grupo = filtros.grupo === "comprador" ? "comprador" : "revendedor";

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/usuarios?grupo=${grupo}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Voltar aos clientes
      </Link>
      <CabecalhoPagina
        sobretitulo="Gestão"
        titulo="Criar conta de cliente"
        descricao="A conta já nasce confirmada. Depois você atribui placas a ela pelo e-mail."
      />
      <Painel className="p-5 sm:p-6">
        <FormNovoUsuario grupo={grupo} />
      </Painel>
    </div>
  );
}
