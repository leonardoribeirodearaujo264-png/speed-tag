import { GerenciarEmpresa } from "./gerenciar-empresa";

export const instant = false;
export const metadata = { title: "Gerenciar empresa" };

export default async function EmpresaCliente({ params, searchParams }: PageProps<"/painel/empresas/[id]">) {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  return <GerenciarEmpresa id={id} busca={busca} />;
}
