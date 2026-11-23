import Link from "next/link";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { FormRegistrar } from "./form-registrar";

export const metadata = { title: "Criar conta" };

export default function Registrar() {
  return (
    <LayoutAutenticacao
      selo="Área administrativa"
      titulo="Criar conta"
      subtitulo="Cadastre-se para gerenciar as placas. Um administrador aprova o seu acesso."
      rodape={
        <>
          Já tem conta?{" "}
          <Link href="/admin/entrar" className="font-medium text-marca-texto hover:text-marca-texto hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <FormRegistrar />
    </LayoutAutenticacao>
  );
}
