"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MailWarning } from "lucide-react";
import { finalizarConfirmacao, type EntradaConfirmacao } from "./acoes";

/** Lê o retorno do link (sessão no #, token_hash ou code na URL) e conclui no servidor. */
function lerEntrada(): EntradaConfirmacao | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const busca = new URLSearchParams(window.location.search);
  const access = hash.get("access_token");
  const refresh = hash.get("refresh_token");
  if (access && refresh) return { tipo: "sessao", accessToken: access, refreshToken: refresh, fluxo: hash.get("type") };
  const tokenHash = busca.get("token_hash");
  const fluxo = busca.get("type");
  if (tokenHash && fluxo) return { tipo: "token_hash", tokenHash, fluxo };
  const codigo = busca.get("code");
  if (codigo) return { tipo: "code", codigo };
  return null;
}

export function ConcluirConfirmacao() {
  const [erro, setErro] = useState<{ mensagem: string; recuperacao: boolean } | null>(null);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const entrada = lerEntrada();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recuperacaoPedida = hash.get("type") === "recovery";
    const descricao = hash.get("error_code");
    // Tira os tokens da barra de endereço e do histórico.
    window.history.replaceState(null, "", window.location.pathname);
    const concluir = entrada
      ? finalizarConfirmacao(entrada)
      : Promise.resolve({
          erro: descricao === "otp_expired" ? "O link expirou ou já foi usado. Peça um novo e-mail." : "Link inválido. Peça um novo e-mail.",
          recuperacao: recuperacaoPedida,
        });
    concluir
      .then((r) => {
        if ("erro" in r) setErro({ mensagem: r.erro, recuperacao: r.recuperacao });
        else window.location.replace(r.destino);
      })
      .catch(() => setErro({ mensagem: "Não foi possível concluir agora. Tente abrir o link de novo.", recuperacao: false }));
  }, []);

  if (erro) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 text-center animate-in fade-in">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <MailWarning className="size-7" aria-hidden />
        </span>
        <p className="text-[15px] leading-relaxed text-slate-700">{erro.mensagem}</p>
        <div className="flex w-full flex-col gap-2">
          <Link href={erro.recuperacao ? "/recuperar-senha" : "/entrar/codigo"} className="flex h-12 items-center justify-center rounded-xl bg-marca font-semibold text-white">
            {erro.recuperacao ? "Pedir novo link de recuperação" : "Receber novo acesso por e-mail"}
          </Link>
          <Link href="/entrar" className="flex min-h-11 items-center justify-center text-sm font-medium text-marca-texto hover:underline">Voltar para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-col items-center gap-4 py-6 text-center">
      <Loader2 className="size-8 animate-spin text-marca" aria-hidden />
      <p className="text-[15px] text-slate-600">Confirmando seu e-mail...</p>
    </div>
  );
}
