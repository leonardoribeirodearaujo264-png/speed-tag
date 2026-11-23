"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";
import type { ResultadoDefinirAdmin } from "@/lib/supabase/tipos";

export type EstadoAdmin =
  | { tipo: "inicial" }
  | { tipo: "sucesso"; mensagem: string }
  | { tipo: "erro"; mensagem: string };

const esquemaNovo = z.object({
  nome: z.string().trim().min(2, "Digite o nome.").max(120),
  email: z.email("Digite um e-mail válido.").max(254),
  senha: z
    .string()
    .min(10, "A senha precisa de pelo menos 10 caracteres.")
    .max(72, "A senha pode ter no máximo 72 caracteres."),
});

const CAMINHO = "/admin/administradores";

export async function cadastrarAdmin(_anterior: EstadoAdmin, dados: FormData): Promise<EstadoAdmin> {
  const { supabase } = await exigirAdmin(CAMINHO);

  const entrada = esquemaNovo.safeParse({
    nome: dados.get("nome"),
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
    senha: dados.get("senha"),
  });
  if (!entrada.success) return { tipo: "erro", mensagem: entrada.error.issues[0]?.message ?? "Dados inválidos." };
  const { nome, email, senha } = entrada.data;

  // 1) Se a pessoa já tem conta (o login é compartilhado com a loja), só promove.
  const primeira = await supabase.rpc("definir_admin", { p_email: email, p_admin: true });
  if (primeira.error) {
    console.error("[admins] definir_admin falhou", primeira.error.code);
    return { tipo: "erro", mensagem: "Não foi possível cadastrar agora. Tente de novo." };
  }
  if ((primeira.data as ResultadoDefinirAdmin).ok) {
    revalidatePath(CAMINHO);
    return {
      tipo: "sucesso",
      mensagem: `${email} já tinha conta e agora é administrador. A senha dele continua a mesma; a senha digitada não foi aplicada.`,
    };
  }

  // 2) Conta nova: criar no Auth com a secret key (só no servidor), já confirmada.
  let servico;
  try {
    servico = clienteSupabaseServico();
  } catch {
    return { tipo: "erro", mensagem: "Falta configurar SUPABASE_SECRET_KEY no servidor para criar contas novas." };
  }

  const criado = await servico.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { name: nome },
  });
  if (criado.error) {
    console.error("[admins] createUser falhou", criado.error.status, criado.error.code);
    const mensagem =
      criado.error.code === "weak_password"
        ? "Senha fraca. Use letras, números e símbolos."
        : "Não foi possível criar a conta. Confira o e-mail e tente de novo.";
    return { tipo: "erro", mensagem };
  }

  const segunda = await supabase.rpc("definir_admin", { p_email: email, p_admin: true });
  if (segunda.error || !(segunda.data as ResultadoDefinirAdmin).ok) {
    console.error("[admins] promoção após criar falhou", segunda.error?.code);
    return { tipo: "erro", mensagem: "A conta foi criada, mas não virou admin. Clique em cadastrar de novo com o mesmo e-mail." };
  }

  revalidatePath(CAMINHO);
  return { tipo: "sucesso", mensagem: `Administrador ${email} cadastrado. Passe a senha para ele por um canal seguro.` };
}

export async function aprovarSolicitacao(email: string): Promise<EstadoAdmin> {
  const { supabase } = await exigirAdmin(CAMINHO);
  if (!z.email().safeParse(email).success) return { tipo: "erro", mensagem: "E-mail inválido." };

  const { data, error } = await supabase.rpc("definir_admin", { p_email: email, p_admin: true });
  if (error || !(data as ResultadoDefinirAdmin).ok) {
    console.error("[admins] aprovar falhou", error?.code);
    return { tipo: "erro", mensagem: "Não foi possível aprovar agora." };
  }
  revalidatePath(CAMINHO);
  return { tipo: "sucesso", mensagem: `${email} aprovado como administrador.` };
}

export async function recusarSolicitacao(usuarioId: string, email: string): Promise<EstadoAdmin> {
  const { supabase } = await exigirAdmin(CAMINHO);
  if (!z.uuid().safeParse(usuarioId).success) return { tipo: "erro", mensagem: "Pedido inválido." };

  const { error } = await supabase.rpc("recusar_solicitacao_admin", { p_usuario: usuarioId });
  if (error) {
    console.error("[admins] recusar falhou", error.code);
    return { tipo: "erro", mensagem: "Não foi possível recusar agora." };
  }
  revalidatePath(CAMINHO);
  return { tipo: "sucesso", mensagem: `Pedido de ${email} recusado.` };
}

export async function removerAdmin(email: string): Promise<EstadoAdmin> {
  const { supabase } = await exigirAdmin(CAMINHO);
  if (!z.email().safeParse(email).success) return { tipo: "erro", mensagem: "E-mail inválido." };

  const { data, error } = await supabase.rpc("definir_admin", { p_email: email, p_admin: false });
  if (error) return { tipo: "erro", mensagem: "Não foi possível remover agora." };

  const resultado = data as ResultadoDefinirAdmin;
  if (!resultado.ok) {
    return {
      tipo: "erro",
      mensagem: resultado.erro === "PROPRIO_USUARIO" ? "Você não pode remover o seu próprio acesso." : "Usuário não encontrado.",
    };
  }

  revalidatePath(CAMINHO);
  return { tipo: "sucesso", mensagem: `${email} não é mais administrador.` };
}
