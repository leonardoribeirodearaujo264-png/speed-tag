import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LayoutAutenticacao } from "@/components/auth/layout-autenticacao";
import { Button } from "@/components/ui/button";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";
import { clienteSupabaseServico, clienteSupabaseUsuario } from "@/lib/supabase/servidor";
import { FormAtivarNfc } from "./form-ativar";

// Página com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;

export const metadata = { title: "Ativar tag NFC", robots: { index: false } };

async function Conteudo({ params }: { params: PageProps<"/ativar/[codigo]">["params"] }) {
  const codigo = normalizarCodigo((await params).codigo);
  if (!codigoValido(codigo)) notFound();

  const { data: tag, error } = await clienteSupabaseServico().from("placas")
    .select("status, dono_id, nfc_entregue_em, preparada_nfc").eq("codigo", codigo).maybeSingle();
  if (error) throw new Error("Falha ao consultar tag NFC");
  if (!tag) notFound();
  if (tag.status === "desativada") redirect(`/placa/${codigo}`);
  // Placa de lote só ativa quem a recebeu na conta; sem atribuição, volta para a página pública.
  if (!tag.preparada_nfc && tag.status !== "atribuida" && tag.status !== "ativa") redirect(`/placa/${codigo}`);

  const retorno = `/ativar/${codigo}`;
  if (tag.status === "ativa") {
    return (
      <div className="space-y-4 text-sm">
        <p>Esta tag está ativa. O endereço permanente já abre a avaliação no Google.</p>
        <a className="font-medium text-marca-texto underline" href={`/t/${codigo}`}>Abrir avaliação no Google</a>
      </div>
    );
  }
  if ((tag.preparada_nfc && !tag.nfc_entregue_em && tag.status !== "atribuida") || tag.status === "reservada") {
    return <p className="text-sm text-muted-foreground">A tag <strong>{codigo}</strong> aguarda liberação. Fale com quem entregou a plaquinha.</p>;
  }

  const supabase = await clienteSupabaseUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4 text-sm">
        <p>Informe seu e-mail para receber um link de acesso. Se você ainda não tem uma conta, ela será criada pelo mesmo fluxo.</p>
        <Button render={<Link href={`/entrar?proximo=${encodeURIComponent(retorno)}`} />} nativeButton={false}>
          Criar conta ou entrar
        </Button>
      </div>
    );
  }

  const titular = user.id === tag.dono_id;
  if (tag.status === "atribuida" && !titular) {
    return (
      <div className="space-y-4 text-sm">
        <p>Entre com o e-mail ao qual esta tag foi atribuída.</p>
        <form action="/auth/sair" method="post">
          <input type="hidden" name="destino" value={retorno} />
          <Button type="submit" variant="outline">Sair e trocar de conta</Button>
        </form>
      </div>
    );
  }

  return <FormAtivarNfc codigo={codigo} exigeSegredo={!titular} />;
}

export default function AtivarTag({ params }: PageProps<"/ativar/[codigo]">) {
  return (
    <LayoutAutenticacao titulo="Ativar tag NFC" subtitulo="Vincule sua plaquinha à empresa que deve receber as avaliações.">
      <Suspense fallback={<p>Consultando tag...</p>}><Conteudo params={params} /></Suspense>
    </LayoutAutenticacao>
  );
}
