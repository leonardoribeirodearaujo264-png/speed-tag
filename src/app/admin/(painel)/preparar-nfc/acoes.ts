"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { codigoValido, gerarCodigo } from "@/lib/codigos";
import { ETAPAS_NFC, ROTA_PREPARO_NFC, type EtapaNfc } from "@/lib/placas/preparo-nfc";
import { gerarSegredoNfc, hashSegredoNfc } from "@/lib/placas/segredo-nfc";

export async function criarTagNfc(): Promise<string> {
  const { supabase } = await exigirAdmin(ROTA_PREPARO_NFC);
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data, error } = await supabase.rpc("placas_preparar_nfc", { p_codigo: gerarCodigo() });
    if (!error && data) {
      revalidatePath(ROTA_PREPARO_NFC);
      redirect(`${ROTA_PREPARO_NFC}/${data}`);
    }
    if (error?.code === "23505" && error.message.includes("COLISAO_CODIGO")) continue;
    console.error("[preparar-nfc] criação", error?.code);
    break;
  }
  return "Não foi possível cadastrar a tag. Tente novamente.";
}

const esquemaEtapa = z.object({ codigo: z.string().refine(codigoValido), etapa: z.enum(ETAPAS_NFC) });

export async function registrarEtapaNfc(codigo: string, etapa: EtapaNfc) {
  const { supabase } = await exigirAdmin(ROTA_PREPARO_NFC);
  const entrada = esquemaEtapa.safeParse({ codigo, etapa });
  if (!entrada.success) return { erro: "Etapa inválida." };

  const segredo = etapa === "entregue" || etapa === "novo_segredo" ? gerarSegredoNfc() : null;
  const { data, error } = await supabase.rpc("placas_etapa_nfc", {
    p_codigo: entrada.data.codigo,
    p_etapa: entrada.data.etapa,
    p_hash: segredo ? hashSegredoNfc(segredo) : null,
  });
  if (error) {
    console.error("[preparar-nfc] etapa", error.code);
    return { erro: "Não foi possível salvar a etapa. Tente novamente." };
  }
  if (!data) return { erro: "Esta etapa não está disponível. Atualize a página e confira o estado da tag." };

  revalidatePath(ROTA_PREPARO_NFC);
  revalidatePath(`${ROTA_PREPARO_NFC}/${codigo}`);
  revalidatePath(`/admin/placas/${codigo}`);
  return { segredo };
}
