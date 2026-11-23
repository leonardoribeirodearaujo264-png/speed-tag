import type { Metadata } from "next";
import { PaginaTexto } from "@/components/paginas/pagina-texto";

export const metadata: Metadata = { title: "Termos de uso" };

export default function Termos() {
  return (
    <PaginaTexto titulo="Termos de uso" atualizado="23/11/2026">
      <p>
        Estes termos valem para o uso da plataforma Speed Tag em speedtag.online: ativação das placas NFC e QR Code,
        painel do cliente e painel administrativo.
      </p>
      <h2>O serviço</h2>
      <ul>
        <li>Cada placa leva o cliente da sua empresa à página de avaliação do Google escolhida na ativação.</li>
        <li>No painel você gerencia suas placas, edita suas empresas e troca os links de avaliação.</li>
        <li>As leituras das placas (data, origem NFC ou QR, tipo de aparelho e país) aparecem como estatística no painel.</li>
      </ul>
      <h2>Sua conta</h2>
      <ul>
        <li>A conta é pessoal. Mantenha a senha em segredo e use um e-mail ao qual você tenha acesso.</li>
        <li>Uma placa ativada fica vinculada à conta que confirmou o e-mail na ativação.</li>
        <li>Você é responsável pelo link de avaliação cadastrado em cada placa.</li>
      </ul>
      <h2>Uso permitido</h2>
      <ul>
        <li>Não é permitido usar as placas para levar a páginas fora do Google, nem tentar ativar placas de terceiros.</li>
        <li>Contas usadas de forma indevida podem ser bloqueadas pela administração.</li>
      </ul>
      <h2>Contato</h2>
      <p>Dúvidas sobre estes termos: fale com quem vendeu a sua placa ou responda a um e-mail de acesso@speedtag.online.</p>
    </PaginaTexto>
  );
}
