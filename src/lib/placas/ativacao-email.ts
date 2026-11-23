import { z } from "zod";
import { clienteAuthAnonimo, mensagemErroEnvio, registrarEnvio, urlRetornoAuth } from "@/lib/auth-email/envio";
import { verificarLinkAvaliacao } from "@/lib/google/links-maps";
import { placaAtivavel } from "@/lib/placas/ativacao";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";
import type { OrigemEmpresa } from "@/lib/supabase/tipos";

/**
 * Ativação pelo NFC só com o e-mail. Nada é ativado aqui: grava o pedido e pede ao
 * Supabase Auth o e-mail de confirmação. A placa só vai para a conta depois que o dono do
 * e-mail abre o link (token de uso único), em /auth/confirmar -> speed_tag_concluir_ativacoes.
 *
 * Regra de autorização (a mesma de ativar_placa_cliente, revalidada na conclusão):
 * placa em estoque sem dono, ou placa já atribuída à conta deste mesmo e-mail.
 */

export type PedidoAtivacao = {
  codigo: string;
  email: string;
  origem: OrigemEmpresa;
  placeId: string | null;
  nome: string;
  link: string;
};

export type ResultadoPedido = { enviado: true; email: string; contaNova: boolean } | { erro: string };

/** Pedidos por placa por hora: barra quem tenta tomar uma placa com vários e-mails. */
const PEDIDOS_POR_PLACA_POR_HORA = 6;

export async function solicitarAtivacaoPorEmail(pedido: PedidoAtivacao): Promise<ResultadoPedido> {
  const email = z.email("Digite um e-mail válido.").max(254).safeParse(pedido.email.trim().toLowerCase());
  if (!email.success) return { erro: email.error.issues[0]?.message ?? "E-mail inválido." };

  const ativavel = await placaAtivavel(pedido.codigo);
  if ("erro" in ativavel) return ativavel;

  const servico = clienteSupabaseServico();
  const { data: placa, error: erroPlaca } = await servico
    .from("placas").select("id, status, dono_id").eq("codigo", ativavel.codigo).maybeSingle();
  if (erroPlaca || !placa) return { erro: "Não foi possível consultar a placa agora." };

  const { data: contaExistente, error: erroConta } = await servico.rpc("usuario_por_email", { p_email: email.data });
  if (erroConta) {
    console.error("[ativacao-email] usuario_por_email", erroConta.code);
    return { erro: "Não foi possível verificar o e-mail agora. Tente de novo." };
  }
  if (placa.dono_id && placa.dono_id !== contaExistente) {
    return { erro: "Esta placa já foi liberada para outra conta. Use o e-mail de quem comprou a placa." };
  }

  // Testa o link final antes de pedir o e-mail: só recusa o que com certeza não funciona.
  const teste = await verificarLinkAvaliacao(pedido.link);
  if (teste.estado === "invalido") return { erro: `O link de avaliação não funciona: ${teste.detalhe}` };

  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await servico.from("speed_tag_ativacoes_pendentes")
    .select("id", { count: "exact", head: true }).eq("placa_id", placa.id).gte("criada_em", umaHoraAtras);
  if ((count ?? 0) >= PEDIDOS_POR_PLACA_POR_HORA) {
    return { erro: "Muitas tentativas de ativação desta placa. Aguarde uma hora ou fale com o suporte." };
  }
  if (!(await registrarEnvio(email.data, "ativacao"))) {
    return { erro: "Limite de e-mails para este endereço atingido. Aguarde e tente de novo mais tarde." };
  }

  const contaNova = !contaExistente;
  const { data: criado, error: erroPedido } = await servico.from("speed_tag_ativacoes_pendentes").insert({
    placa_id: placa.id,
    email: email.data,
    conta_nova: contaNova,
    origem: pedido.origem,
    place_id: pedido.placeId,
    nome: pedido.nome,
    link: pedido.link,
  }).select("id").single();
  if (erroPedido || !criado) {
    console.error("[ativacao-email] gravar pedido", erroPedido?.code);
    return { erro: "Não foi possível registrar a ativação agora. Tente de novo." };
  }

  // Conta nova: o Supabase cria a conta (sem senha) e manda "Confirme seu cadastro".
  // Conta existente: manda o link de acesso; a placa entra na conta ao confirmar, sem nova senha.
  const { error: erroEnvio } = await clienteAuthAnonimo().auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: await urlRetornoAuth(),
      shouldCreateUser: contaNova,
      ...(contaNova ? { data: { senha_pendente: true, origem_cadastro: "nfc" } } : {}),
    },
  });
  if (erroEnvio) {
    console.error("[ativacao-email] envio", erroEnvio.status, erroEnvio.code);
    await servico.from("speed_tag_ativacoes_pendentes").delete().eq("id", criado.id);
    return { erro: mensagemErroEnvio(erroEnvio.status) };
  }
  return { enviado: true, email: email.data, contaNova };
}
