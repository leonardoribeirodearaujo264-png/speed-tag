import { GerenciarEmpresa } from "@/app/painel/empresas/[id]/gerenciar-empresa";

export const instant = false;
export const metadata = { title: "Gerenciar empresa" };

export default async function EmpresaAdmin({ params, searchParams }: PageProps<"/admin/empresas/[id]">) {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  return <GerenciarEmpresa id={id} busca={busca} admin />;
}
