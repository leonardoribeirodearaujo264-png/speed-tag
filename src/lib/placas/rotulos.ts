import type { StatusPlaca } from "@/lib/supabase/tipos";

export const ROTULO_STATUS: Record<StatusPlaca, string> = {
  disponivel: "Em estoque",
  reservada: "Reservada",
  atribuida: "Aguardando ativação",
  ativa: "Ativa",
  desativada: "Desativada",
};

export const VARIANTE_STATUS: Record<StatusPlaca, "default" | "secondary" | "destructive"> = {
  disponivel: "secondary",
  reservada: "secondary",
  atribuida: "secondary",
  ativa: "default",
  desativada: "destructive",
};

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatarData(iso: string | null): string {
  return iso ? formatoData.format(new Date(iso)) : "";
}
