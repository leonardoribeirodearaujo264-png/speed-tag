import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Sem permissão" };

export default function SemPermissao() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Esta área é só para administradores</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Sua conta não tem acesso ao painel de administração. Se você é cliente, acompanhe suas placas no seu painel.
      </p>
      <div className="flex gap-2">
        <Link href="/painel" className={buttonVariants()}>
          Ir para meu painel
        </Link>
        <form action="/auth/sair" method="post">
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
