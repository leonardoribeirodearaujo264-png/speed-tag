"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Modal } from "@/components/admin/modal";
import { GeradorLink } from "@/components/link-avaliacao/gerador-link";
import { Button } from "@/components/ui/button";
import { vincularLinkAPlaca } from "@/lib/acoes/link-avaliacao";

/** Botão do painel do cliente: gera um novo link de avaliação e troca o destino da placa. */
export function TrocarDestino({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="outline" className="min-h-11 grow sm:min-h-9 sm:grow-0" onClick={() => setAberto(true)}>
        <Link2 /> Trocar destino
      </Button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={`Destino da placa ${codigo}`} descricao="Escolha a empresa ou cole o link. A placa passa a levar à nova avaliação na hora.">
        <GeradorLink
          aoVincular={(v) => vincularLinkAPlaca(codigo, v)}
          aoConcluir={() => {
            setAberto(false);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
