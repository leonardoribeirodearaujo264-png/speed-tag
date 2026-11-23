import type { Placa } from "@/lib/supabase/tipos";

export const ROTA_PREPARO_NFC = "/admin/preparar-nfc";

export const ETAPAS_NFC = ["gravada", "testada", "entregue", "novo_segredo"] as const;
export type EtapaNfc = (typeof ETAPAS_NFC)[number];

export function marcosNfc(placa: Pick<Placa, "criado_em" | "nfc_gravado_em" | "nfc_testada_em" | "nfc_entregue_em" | "ativada_em">) {
  return [
    { rotulo: "Criada", data: placa.criado_em },
    { rotulo: "Gravada", data: placa.nfc_gravado_em },
    { rotulo: "Testada", data: placa.nfc_testada_em },
    { rotulo: "Entregue", data: placa.nfc_entregue_em },
    { rotulo: "Ativada", data: placa.ativada_em },
  ];
}
