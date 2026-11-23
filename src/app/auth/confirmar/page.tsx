import type { Metadata } from "next";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { ConcluirConfirmacao } from "./concluir";

export const metadata: Metadata = { title: "Confirmando", robots: { index: false } };

/** Destino dos links de e-mail (confirmação, acesso, recuperação, convite). */
export default function Confirmar() {
  return (
    <LayoutAutenticacao titulo="Só um instante" subtitulo="Estamos validando o link do seu e-mail.">
      <ConcluirConfirmacao />
    </LayoutAutenticacao>
  );
}
