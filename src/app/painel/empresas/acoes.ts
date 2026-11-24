"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { linkGooglePermitido } from "@/lib/google/dominios";
import { redirect } from "next/navigation";

export async function gerenciarEmpresaCliente(empresa: string, acao: "editar" | "excluir", _anterior: string, dados: FormData) {
  if (!z.uuid().safeParse(empresa).success) return "Empresa inválida.";
  const link = dados.get("link");
  if (acao === "editar" && (typeof link !== "string" || !linkGooglePermitido(link.trim()))) {
    return "Informe um link de avaliação válido do Google.";
  }
  if (acao === "excluir" && dados.get("confirmar") !== "on") return "Confirme a exclusão.";
  if (acao !== "editar" && acao !== "excluir") return "Ação inválida.";

  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.rpc("speed_tag_gerenciar_empresa_cliente", {
    p_empresa: empresa, p_link: acao === "editar" && typeof link === "string" ? link.trim() : null,
  });
  if (error || !data) return "Não foi possível alterar esta empresa. Confira o acesso ou tente novamente.";
  revalidatePath("/admin/empresas");
  revalidatePath("/admin/placas");
  revalidatePath("/painel/empresas");
  redirect("/painel/empresas");
}

export async function atualizarPerfilCliente(_anterior: string, dados: FormData) {
  const nome = z.string().trim().min(1).max(120).safeParse(dados.get("nome"));
  if (!nome.success) return "Informe um nome de até 120 caracteres.";
  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Entre novamente para atualizar seu perfil.";
  const { data: liberado } = await supabase.rpc("speed_tag_acesso_cliente");
  if (!liberado) return "Sua conta precisa estar liberada para alterar o perfil.";
  const { data, error } = await supabase.from("perfis").update({ nome: nome.data }).eq("id", user.id).select("id").maybeSingle();
  if (error || !data) return "Não foi possível salvar o seu nome.";
  revalidatePath("/painel");
  revalidatePath("/painel/inicio");
  revalidatePath("/painel/empresas");
  return "Nome atualizado.";
}

export async function vincularEmpresaPlaca(empresa: string, _anterior: string, dados: FormData) {
  const codigo = normalizarCodigo(String(dados.get("codigo") ?? "").slice(0, 20));
  if (!z.uuid().safeParse(empresa).success || !codigoValido(codigo) || dados.get("confirmar") !== "on") {
    return "Confira o código e confirme a alteração do destino.";
  }
  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.rpc("speed_tag_vincular_empresa", { p_empresa: empresa, p_codigo: codigo });
  if (error?.message === "LIMITE_PLACAS") return "O titular atingiu o limite de placas da conta.";
  if (error || !data) return "Não foi possível vincular. Confira o código, a disponibilidade da placa e o link de avaliação da empresa.";
  revalidatePath("/painel");
  revalidatePath("/painel/empresas");
  revalidatePath(`/painel/empresas/${empresa}`);
  revalidatePath(`/admin/empresas/${empresa}`);
  revalidatePath("/admin/placas");
  revalidatePath(`/admin/placas/${codigo}`);
  return `Placa ${codigo} vinculada à empresa.`;
}

export async function removerPlacaDaEmpresa(empresa: string, codigo: string, _anterior: string, dados: FormData) {
  if (!z.uuid().safeParse(empresa).success || !codigoValido(codigo) || dados.get("confirmar") !== "on") {
    return "Confirme a remoção da placa.";
  }
  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.rpc("speed_tag_remover_placa_da_empresa", { p_empresa: empresa, p_codigo: codigo });
  if (error?.code === "PGRST202") return "A remoção depende da atualização do banco de dados.";
  if (error || !data) return "Não foi possível remover esta placa da empresa.";
  revalidatePath("/painel");
  revalidatePath("/painel/empresas");
  revalidatePath(`/painel/empresas/${empresa}`);
  revalidatePath(`/admin/empresas/${empresa}`);
  revalidatePath(`/admin/placas/${codigo}`);
  return "Placa removida da empresa.";
}

export async function definirSenhaCliente(_anterior: { mensagem: string; ok: boolean }, dados: FormData) {
  const senha = z.string().min(10).max(72).safeParse(dados.get("senha"));
  if (!senha.success || new TextEncoder().encode(senha.data).length > 72 || senha.data !== dados.get("confirmacao")) {
    return { ok: false, mensagem: "Confira se as senhas coincidem e têm entre 10 e 72 caracteres." };
  }
  const supabase = await clienteSupabaseUsuario();
  const { data: liberado } = await supabase.rpc("speed_tag_acesso_cliente");
  if (!liberado) return { ok: false, mensagem: "Entre novamente para alterar a senha." };

  const { error } = await supabase.auth.updateUser({ password: senha.data });
  if (error) {
    return { ok: false, mensagem: error.code === "reauthentication_needed"
      ? "Entre novamente com um link de e-mail e volte a esta tela para definir a senha."
      : "Não foi possível salvar a senha. Confira os requisitos da conta e tente novamente." };
  }
  return { ok: true, mensagem: "Senha atualizada." };
}
