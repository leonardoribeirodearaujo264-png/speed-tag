import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exigirAdmin } from "@/lib/auth";
import { formatarData } from "@/lib/placas/rotulos";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Lotes" };

export default async function ListaLotes() {
  const { supabase } = await exigirAdmin("/admin/lotes");
  const { data: lotes, error } = await supabase
    .from("lotes")
    .select("id, nome, quantidade, revendedor, criado_em")
    .order("criado_em", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lotes</h1>
          <p className="text-sm text-muted-foreground">Produção em quantidade, com exportação para a gráfica.</p>
        </div>
        <Link href="/admin/lotes/novo" className={buttonVariants()}>
          <Plus aria-hidden /> Criar lote
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar os lotes. Recarregue a página.
        </p>
      ) : !lotes?.length ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center">
          <p className="font-medium">Nenhum lote ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie um lote para gerar várias placas de uma vez.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Placas</TableHead>
                <TableHead className="hidden sm:table-cell">Revendedor</TableHead>
                <TableHead className="hidden md:table-cell">Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotes.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link href={`/admin/lotes/${l.id}`} className="font-medium text-marca-texto hover:underline">
                      {l.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.quantidade.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{l.revendedor ?? ""}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatarData(l.criado_em)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
