"use server";

// Versões anteriores do painel ainda podem tentar chamar esta ação.
export async function registrarPlacaPropria(): Promise<string> {
  return "Somente administradores podem criar placas. Use o código da placa comprada para adicioná-la.";
}
