"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { codigoValido } from "@/lib/codigos";
import { buscarEmpresas, esquemaPlaceId, obterEmpresaParaAtivacao } from "@/lib/google/places";
import { ROTA_PREPARO_NFC } from "@/lib/placas/preparo-nfc";
import { hashSegredoNfc } from "@/lib/placas/segredo-nfc";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";

const credencial = z.object({ codigo: z.string().refine(codigoValido), segredo: z.string().max(80) });
const NEGADA = "Confira o código secreto da entrega ou entre com a conta à qual a tag foi atribuída. A tag precisa estar entregue e aguardando ativação.";

async function autorizar(codigo: string, segredo: string) {
  const entrada = credencial.safeParse({ codigo, segredo });
  if (!entrada.success) return { ok: false, erro: "Código ou segredo inválido." } as const;
  const usuario = await clienteSupabaseUsuario();
  const { data: { user }, error: erroAuth } = await usuario.auth.getUser();
  if (erroAuth || !user) return { ok: false, erro: "Entre novamente para continuar." } as const;

  const servico = clienteSupabaseServico();
  const args = { p_codigo: entrada.data.codigo, p_ator: user.id, p_hash: hashSegredoNfc(entrada.data.segredo) };
  const { data, error } = await servico.rpc("placas_consultar_nfc", args);
  if (error) {
    console.error("[ativar-nfc] autorização", error.code);
    return { ok: false, erro: "Não foi possível verificar a tag agora." } as const;
  }
  if (data === "aguarde") return { ok: false, erro: "Aguarde alguns segundos e tente novamente." } as const;
  if (data !== "ok") return { ok: false, erro: NEGADA } as const;
  return { ok: true, usuario, servico, args } as const;
}

export async function pesquisarEmpresaNfc(codigo: string, segredo: string, consulta: string) {
  const busca = z.string().trim().min(3).max(180).safeParse(consulta);
  if (!busca.success) return { erro: "Digite entre 3 e 180 caracteres para pesquisar." };
  const acesso = await autorizar(codigo, segredo);
  if (!acesso.ok) return { erro: acesso.erro };

  try {
    return { empresas: await buscarEmpresas(busca.data) };
  } catch (erro) {
    console.error("[ativar-nfc] busca no Google", erro instanceof Error ? erro.message : "erro");
    return { erro: "A busca no Google está indisponível. Tente novamente em instantes." };
  }
}

export async function confirmarEmpresaNfc(codigo: string, segredo: string, placeId: string) {
  const local = esquemaPlaceId.safeParse(placeId);
  if (!local.success) return { erro: "Selecione uma empresa da busca." };
  const acesso = await autorizar(codigo, segredo);
  if (!acesso.ok) return { erro: acesso.erro };

  const { error: erroPerfil } = await acesso.usuario.rpc("garantir_perfil");
  if (erroPerfil) {
    console.error("[ativar-nfc] perfil", erroPerfil.code);
    return { erro: "Não foi possível preparar sua conta para a ativação." };
  }

  let empresa: Awaited<ReturnType<typeof obterEmpresaParaAtivacao>>;
  try {
    empresa = await obterEmpresaParaAtivacao(local.data);
  } catch (erro) {
    console.error("[ativar-nfc] detalhes no Google", erro instanceof Error ? erro.message : "erro");
    return { erro: "Não foi possível confirmar a empresa no Google. Tente novamente." };
  }

  const { data, error } = await acesso.servico.rpc("placas_ativar_nfc", {
    ...acesso.args, p_place_id: empresa.id, p_nome: empresa.nome, p_link: empresa.link,
  });
  if (error) {
    console.error("[ativar-nfc] ativação", error.code);
    return { erro: "Não foi possível salvar a ativação. Tente novamente." };
  }
  if (!data) return { erro: NEGADA };

  revalidatePath(ROTA_PREPARO_NFC);
  revalidatePath(`${ROTA_PREPARO_NFC}/${codigo}`);
  revalidatePath(`/admin/placas/${codigo}`);
  revalidatePath(`/ativar/${codigo}`);
  return { ativada: true };
}
