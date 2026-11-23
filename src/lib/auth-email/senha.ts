"use server";

import { redirect } from "next/navigation";
import { caminhoInternoSeguro } from "@/lib/auth";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { validarSenha } from "@/lib/auth-email/regras-senha";

export type EstadoNovaSenha = { erro: string };

/**
 * Cria ou troca a senha de quem já está autenticado (link do e-mail validado em
 * /auth/confirmar). A senha vai só para o Supabase Auth; nada é guardado em tabela nossa.
 */
export async function salvarNovaSenha(destino: string, _anterior: EstadoNovaSenha, dados: FormData): Promise<EstadoNovaSenha> {
  const senha = String(dados.get("senha") ?? "");
  const problema = validarSenha(senha, String(dados.get("confirmacao") ?? ""));
  if (problema) return { erro: problema };

  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "O link expirou. Peça um novo e-mail para continuar." };

  const { error } = await supabase.auth.updateUser({ password: senha, data: { senha_pendente: false } });
  if (error) {
    console.error("[senha] updateUser", error.status, error.code);
    return {
      erro: error.code === "same_password"
        ? "Use uma senha diferente da atual."
        : error.code === "weak_password"
          ? "Senha fraca. Misture letras, números e símbolos."
          : error.code === "reauthentication_needed"
            ? "Por segurança, peça um novo link por e-mail e tente de novo."
            : "Não foi possível salvar a senha agora. Tente de novo.",
    };
  }
  redirect(caminhoInternoSeguro(destino, "/painel/empresas"));
}
