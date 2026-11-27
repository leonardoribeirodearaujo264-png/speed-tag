/** WhatsApp de vendas da Speed Tag (DDI + DDD + número, só dígitos). */
export const WHATSAPP_VENDAS = "5511966218520";

export const MENSAGEM_COMPRA = "Olá, tenho interesse em mais plaquinhas.";

/** Link que abre a conversa no WhatsApp com a mensagem pronta. */
export function linkWhatsappCompra(numero = WHATSAPP_VENDAS, mensagem = MENSAGEM_COMPRA): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
