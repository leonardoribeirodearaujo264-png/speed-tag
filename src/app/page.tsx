import { Suspense } from "react";
import { redirect } from "next/navigation";

/**
 * A página inicial leva ao login. Exceção: link de e-mail do Auth que caiu aqui porque o
 * Supabase usou o endereço do site (convite pelo painel, por exemplo): segue para a confirmação.
 */
async function Redirecionar({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { token_hash: token, type: tipo } = await searchParams;
  if (typeof token === "string" && typeof tipo === "string") {
    redirect(`/auth/confirmar?${new URLSearchParams({ token_hash: token, type: tipo })}`);
  }
  redirect("/entrar");
  return null;
}

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <Suspense>
      <Redirecionar searchParams={searchParams} />
    </Suspense>
  );
}
