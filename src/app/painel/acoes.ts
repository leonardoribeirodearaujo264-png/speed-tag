"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { gerarCodigo } from "@/lib/codigos";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export async function registrarPlacaPropria(empresas = false): Promise<string> {
  const supabase = await clienteSupabaseUsuario();
  for (let i = 0; i < 3; i++) {
    const codigo = gerarCodigo();
    const { data, error } = await supabase.rpc("speed_tag_criar_placa_propria", { p_codigo: codigo });
    if (error?.code === "23505") continue;
    if (error?.message === "LIMITE_PLACAS") return "Sua conta atingiu o limite de placas.";
    if (error) return "Não foi possível cadastrar a placa agora.";
    if (!data) return "A solicitação requer uma conta liberada e um limite de placas configurado.";
    revalidatePath("/painel");
    revalidatePath("/painel/empresas");
    revalidatePath("/painel/inicio");
    redirect(empresas ? `/painel/empresas?placa=${codigo}` : `/ativar/${codigo}`);
  }
  return "Não foi possível gerar o código da placa. Tente novamente.";
}
