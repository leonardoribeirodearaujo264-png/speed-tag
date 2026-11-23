"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { exigirAdmin } from "@/lib/auth";
import { contaDoEmail } from "@/lib/placas/ativacao";
import { linkGooglePermitido } from "@/lib/google/dominios";

type EstadoEmpresa = { mensagem: string; ok: boolean };

const cadastro = z.object({
  nome: z.string().trim().min(1).max(200),
  email: z.union([z.email().max(254), z.literal("")]),
  link: z.string().trim().max(2048),
});

export async function salvarEmpresa(id: string | null, admin: boolean, _anterior: EstadoEmpresa, dados: FormData): Promise<EstadoEmpresa> {
  const entrada = cadastro.safeParse({
    nome: dados.get("nome"),
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
    link: dados.get("link") ?? "",
  });
  if (!entrada.success || (id !== null && !z.uuid().safeParse(id).success)) {
    return { ok: false, mensagem: "Confira o nome e o e-mail da empresa." };
  }
  const { nome, email, link } = entrada.data;
  if (!id && !email) return { ok: false, mensagem: "Informe um e-mail para cadastrar a empresa." };
  if (link && !linkGooglePermitido(link)) return { ok: false, mensagem: "Informe um link de avaliação do Google." };

  const supabase = admin ? (await exigirAdmin("/admin/empresas")).supabase : await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensagem: "Entre novamente para continuar." };

  let dono = user.id;
  if (!id && admin && email !== user.email?.toLowerCase()) {
    const conta = await contaDoEmail(email);
    if ("erro" in conta) return { ok: false, mensagem: conta.erro };
    dono = conta.id;
  }

  const { data, error } = id
    ? await supabase.rpc(dados.has("editar_link") ? "speed_tag_editar_empresa_completa" : "speed_tag_editar_empresa", { p_empresa: id, p_nome: nome, p_email: email || null, p_link: link || null })
    : await supabase.rpc("speed_tag_cadastrar_empresa", { p_dono: dono, p_nome: nome, p_email: email, p_link: link || null });
  if (error || !data) {
    return { ok: false, mensagem: error?.code === "23505"
      ? "Já existe uma empresa com esse nome na conta."
      : error?.code === "PGRST202" ? "A edição completa depende da atualização do banco de dados."
        : "Não foi possível salvar. Confira se a conta está liberada e tente novamente." };
  }
  revalidatePath("/admin/empresas");
  revalidatePath("/painel");
  revalidatePath("/painel/empresas");
  if (id) {
    revalidatePath(`/painel/empresas/${id}`);
    revalidatePath(`/admin/empresas/${id}`);
  }
  return { ok: true, mensagem: id ? "Dados atualizados." : "Empresa cadastrada." };
}

export async function editarNomeEmpresa(id: string, _anterior: string, dados: FormData) {
  const entrada = z.object({ id: z.uuid(), nome: z.string().trim().min(1).max(200) }).safeParse({ id, nome: dados.get("nome") });
  if (!entrada.success) return "Informe um nome válido.";
  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.rpc("speed_tag_renomear_empresa", { p_empresa: entrada.data.id, p_nome: entrada.data.nome });
  if (error || !data) return "Não foi possível editar esta empresa.";
  revalidatePath("/admin/empresas");
  revalidatePath("/painel");
  revalidatePath("/painel/empresas");
  return "Nome atualizado.";
}
