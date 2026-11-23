import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { envGoogle } from "@/lib/env";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";

/**
 * Limite de uso do Google Places (custo). Cada operação que chama o Google consome
 * uma unidade da cota de quem pede (IP para quem não tem login, conta para quem tem)
 * e uma da cota total do dia. Passou do limite: a operação nem chega ao Google.
 */
const LIMITES = {
  anonimo: { quantidade: 30, janela: 600 },
  usuario: { quantidade: 120, janela: 600 },
} as const;

export const MENSAGEM_COTA = "Muitas buscas em pouco tempo. Aguarde alguns minutos ou use o link manual.";

async function chaveDoVisitante(usuarioId?: string): Promise<{ chave: string; tipo: keyof typeof LIMITES }> {
  if (usuarioId) return { chave: `u:${usuarioId}`, tipo: "usuario" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
  // Guarda só um resumo do IP, nunca o IP.
  return { chave: `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`, tipo: "anonimo" };
}

async function consumir(chave: string, limite: number, janela: number): Promise<boolean | "sem_funcao"> {
  const { data, error } = await clienteSupabaseServico().rpc("consumir_cota_google", {
    p_chave: chave,
    p_limite: limite,
    p_janela_segundos: janela,
  });
  if (error) {
    // Migração ainda não aplicada: não derruba a ativação, mas avisa no log.
    if (error.code === "PGRST202") return "sem_funcao";
    console.error("[cota-google]", error.code);
    return false;
  }
  return data === true;
}

/** true se pode chamar o Google agora. Em falha do banco, nega (protege o custo). */
export async function consumirCotaGoogle(usuarioId?: string): Promise<boolean> {
  const { chave, tipo } = await chaveDoVisitante(usuarioId);
  const pessoal = await consumir(chave, LIMITES[tipo].quantidade, LIMITES[tipo].janela);
  if (pessoal === "sem_funcao") {
    console.warn("[cota-google] função consumir_cota_google ausente: rode a migração 0014");
    return true;
  }
  if (!pessoal) return false;
  return (await consumir("dia:total", envGoogle().GOOGLE_LIMITE_DIARIO, 86_400)) === true;
}
