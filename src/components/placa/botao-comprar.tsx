import { ShoppingBag } from "lucide-react";
import { linkWhatsappCompra } from "@/lib/contato";

/** Abre o WhatsApp de vendas com a mensagem pronta para comprar mais placas. */
export function BotaoComprar({ className = "" }: { className?: string }) {
  return (
    <a href={linkWhatsappCompra()} target="_blank" rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-[#073b1c] hover:bg-[#1fbe5b] focus-visible:ring-2 focus-visible:ring-cyan-300 ${className}`}>
      <ShoppingBag className="size-4" aria-hidden /> Comprar placas
    </a>
  );
}
