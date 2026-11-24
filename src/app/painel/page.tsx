import { redirect } from "next/navigation";

/** Endereço antigo: o redirecionamento de next.config.ts responde antes; isto é só a garantia. */
export default function PainelCliente() {
  redirect("/painel/empresas");
}
