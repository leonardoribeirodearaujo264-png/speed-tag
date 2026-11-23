"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { GeradorLink } from "@/components/link-avaliacao/gerador-link";
import { vincularLinkAPlaca } from "@/lib/acoes/link-avaliacao";

/** Botão do painel do cliente: gera um novo link de avaliação e troca o destino da placa. */
export function TrocarDestino({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  return (
    <DialogoEmpresa tipo="destino" botao="Trocar destino" titulo={`Destino da placa ${codigo}`}
      descricao="Escolha a empresa ou cole o link. A placa passa a levar à nova avaliação na hora."
      aberto={aberto} aoMudar={setAberto}
      classeBotao="min-h-11 grow basis-36 px-3 sm:min-h-9 sm:grow-0 sm:basis-auto">
      <GeradorLink
        aoVincular={(v) => vincularLinkAPlaca(codigo, v)}
        aoConcluir={() => {
          setAberto(false);
          router.refresh();
        }}
      />
    </DialogoEmpresa>
  );
}
