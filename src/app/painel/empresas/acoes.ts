"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

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
  if (error || !data) return "Não foi possível vincular. Confira se a placa e a empresa pertencem à sua conta e se a empresa tem um link de avaliação.";
  revalidatePath("/painel");
  revalidatePath("/painel/empresas");
  revalidatePath(`/admin/placas/${codigo}`);
  return `Placa ${codigo} vinculada à empresa.`;
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
