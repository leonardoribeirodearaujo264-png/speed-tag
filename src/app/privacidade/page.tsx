import type { Metadata } from "next";
import { PaginaTexto } from "@/components/paginas/pagina-texto";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <PaginaTexto titulo="Política de privacidade" atualizado="23/11/2026">
      <p>Esta política explica quais dados a Speed Tag trata para funcionar e como eles são protegidos.</p>
      <h2>Dados da conta</h2>
      <ul>
        <li>Nome, e-mail e telefone informados no cadastro.</li>
        <li>A senha é guardada apenas pelo serviço de autenticação (Supabase Auth), de forma criptografada. Não temos acesso a ela.</li>
      </ul>
      <h2>Dados das empresas e placas</h2>
      <ul>
        <li>Nome, endereço e link de avaliação da empresa, obtidos do Google na ativação.</li>
        <li>Leituras das placas: data e hora, origem (NFC ou QR Code), tipo de aparelho e país. Não guardamos o endereço IP de quem lê a placa.</li>
      </ul>
      <h2>Para que usamos</h2>
      <ul>
        <li>Levar quem lê a placa à avaliação da sua empresa e mostrar as estatísticas no seu painel.</li>
        <li>Enviar os e-mails de confirmação, acesso e recuperação de senha (remetente acesso@speedtag.online).</li>
      </ul>
      <h2>Compartilhamento</h2>
      <p>
        Os dados ficam no Supabase (banco e autenticação) e os e-mails são enviados pelo Resend. A busca de empresas usa o
        Google. Não vendemos nem cedemos seus dados para publicidade.
      </p>
      <h2>Seus direitos</h2>
      <p>Você pode pedir a correção ou a exclusão dos seus dados respondendo a um e-mail de acesso@speedtag.online.</p>
    </PaginaTexto>
  );
}
