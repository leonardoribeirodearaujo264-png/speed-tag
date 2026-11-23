"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { codigoValido } from "@/lib/codigos";
import { linkEscreverAvaliacao, linkGooglePermitido } from "@/lib/google/dominios";
import { buscarEmpresas, esquemaPlaceId, type EmpresaEncontrada } from "@/lib/google/places";
import type { ResultadoMassa } from "../acoes-massa";

const esquemaNome = z.string().trim().min(1, "Informe o nome da empresa.").max(200, "Nome muito longo.");

export type NovaEmpresa =
  | { tipo: "google"; placeId: string; nome: string }
  | { tipo: "link"; nome: string; link: string };

/** Busca empresas no Google para o admin trocar o destino de uma placa ativa. */
export async function pesquisarEmpresaAdmin(consulta: string): Promise<{ empresas: EmpresaEncontrada[] } | { erro: string }> {
  await exigirAdmin("/admin/placas");
  const busca = z.string().trim().min(3).max(180).safeParse(consulta);
  if (!busca.success) return { erro: "Digite pelo menos 3 letras." };
  try {
    return { empresas: await buscarEmpresas(busca.data) };
  } catch (erro) {
    console.error("[admin] busca no Google", erro instanceof Error ? erro.message : "erro");
    return { erro: "A busca no Google está indisponível agora. Use o link manual." };
  }
}

/** Troca a empresa (e o destino) de uma placa ativa, pela função trocar_destino do banco. */
export async function trocarEmpresaAdmin(codigo: string, nova: NovaEmpresa): Promise<ResultadoMassa> {
  const { supabase } = await exigirAdmin(`/admin/placas/${codigo}`);
  if (!codigoValido(codigo)) return { ok: false, mensagem: "Placa inválida." };
  const nome = esquemaNome.safeParse(nova.nome);
  if (!nome.success) return { ok: false, mensagem: nome.error.issues[0]?.message ?? "Nome inválido." };

  let link: string;
  let placeId: string | null = null;
  if (nova.tipo === "google") {
    if (!esquemaPlaceId.safeParse(nova.placeId).success) return { ok: false, mensagem: "Selecione uma empresa da lista." };
    placeId = nova.placeId;
    link = linkEscreverAvaliacao(nova.placeId);
  } else {
    link = nova.link.trim();
    if (!linkGooglePermitido(link)) return { ok: false, mensagem: "Use um link de avaliação do Google (https://g.page/..., maps.app.goo.gl ou search.google.com)." };
  }

  const { data: placa } = await supabase.from("placas").select("id").eq("codigo", codigo).maybeSingle();
  if (!placa) return { ok: false, mensagem: "Placa não encontrada." };

  const { data, error } = await supabase.rpc("trocar_destino", {
    p_placa_id: placa.id,
    p_origem: nova.tipo === "google" ? "google_places" : "manual",
    p_place_id: placeId,
    p_nome: nome.data,
    p_link: link,
  });
  if (error) {
    console.error("[admin] trocar_destino", error.code);
    return { ok: false, mensagem: "Não foi possível trocar a empresa agora." };
  }
  const r = data as { ok: boolean; erro?: string };
  if (!r.ok) {
    return { ok: false, mensagem: r.erro === "PLACA_NAO_ATIVA" ? "Só placas ativas podem trocar de empresa." : "Dados inválidos para a troca." };
  }
  revalidatePath(`/admin/placas/${codigo}`);
  revalidatePath("/admin/placas");
  return { ok: true, mensagem: `Empresa trocada para ${nome.data}.` };
}
