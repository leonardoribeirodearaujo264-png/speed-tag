import { after } from "next/server";
import { z } from "zod";
import { clienteAuthAnonimo, registrarEnvio, urlRetornoAuth } from "@/lib/auth-email/envio";
import { normalizarCodigo, codigoValido } from "@/lib/codigos";
import { verificarLinkAvaliacao } from "@/lib/google/links-maps";
import { ativarParaConta, type Erro } from "@/lib/placas/ativacao";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";
import type { OrigemEmpresa } from "@/lib/supabase/tipos";

export type PedidoAtivacao = {
  codigo: string;
  email: string;
  origem: OrigemEmpresa;
  placeId: string | null;
  nome: string;
  link: string;
};

export type ResultadoPedido = { ativada: true } | Erro;

export async function ativarPeloNfc(pedido: PedidoAtivacao): Promise<ResultadoPedido> {
  const entrada = z.email("Digite um e-mail válido.").max(254).safeParse(pedido.email.trim().toLowerCase());
  if (!entrada.success) return { erro: entrada.error.issues[0]?.message ?? "E-mail inválido." };
  const email = entrada.data;
  const codigo = normalizarCodigo(pedido.codigo);
  if (!codigoValido(codigo)) return { erro: "Placa inválida." };

  const servico = clienteSupabaseServico();
  const { data: placa, error: erroPlaca } = await servico.from("placas")
    .select("status, dono_id").eq("codigo", codigo).maybeSingle();
  if (erroPlaca || !placa) return { erro: "Não foi possível consultar a placa agora." };
  if (placa.dono_id) return { erro: "Esta placa já está vinculada. Entre na conta do titular para gerenciá-la." };
  if (placa.status !== "disponivel") return { erro: "Esta placa não está disponível para ativação." };

  const teste = await verificarLinkAvaliacao(pedido.link);
  if (teste.estado === "invalido") return { erro: `O link de avaliação não funciona: ${teste.detalhe}` };
  const retorno = await urlRetornoAuth();

  const { data: existente, error: erroConta } = await servico.rpc("usuario_por_email", { p_email: email });
  if (erroConta) return { erro: "Não foi possível consultar a conta agora. Tente novamente." };

  let usuarioId = existente;
  if (!usuarioId) {
    // A conta ainda precisa comprovar posse do e-mail para fazer login.
    const { data, error } = await servico.auth.admin.createUser({
      email,
      user_metadata: { senha_pendente: true, origem_cadastro: "nfc" },
    });
    if (error || !data.user) return { erro: "Não foi possível preparar sua conta. Tente novamente." };
    usuarioId = data.user.id;
  }

  const { error: erroPerfil } = await servico.from("perfis")
    .upsert({ id: usuarioId, email }, { onConflict: "id", ignoreDuplicates: true });
  if (erroPerfil) return { erro: "Não foi possível preparar seu perfil. Tente novamente." };

  const resultado = await ativarParaConta(codigo, usuarioId, pedido.origem, pedido.placeId, pedido.nome, pedido.link);
  if ("erro" in resultado) return resultado;

  after(async () => {
    if (!(await registrarEnvio(email, "ativacao"))) return;
    const { error } = await clienteAuthAnonimo().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: retorno, shouldCreateUser: false },
    });
    if (error) console.error("[ativacao-email] envio após ativar", error.status, error.code);
  });

  return resultado;
}
