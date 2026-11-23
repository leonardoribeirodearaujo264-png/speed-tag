import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exigirAdmin } from "@/lib/auth";
import { formatarData } from "@/lib/placas/rotulos";
import { AcoesPedido } from "./acoes-pedido";
import { BotaoRemover } from "./botao-remover";
import { FormNovoAdmin } from "./form-novo-admin";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Administradores" };

export default async function Administradores() {
  const { supabase, usuarioId } = await exigirAdmin("/admin/administradores");
  const { data: admins, error } = await supabase
    .from("perfis")
    .select("id, nome, email, criado_em")
    .eq("papel", "admin")
    .order("criado_em");
  const { data: pedidos } = await supabase
    .from("perfis")
    .select("id, nome, email, solicitou_admin_em")
    .eq("papel", "cliente")
    .not("solicitou_admin_em", "is", null)
    .order("solicitou_admin_em");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administradores</h1>
        <p className="text-sm text-muted-foreground">Quem pode criar placas, lotes e gravar NFC.</p>
      </div>

      {!!pedidos?.length && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pedidos de acesso
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">{pedidos.length}</span>
            </CardTitle>
            <CardDescription>Pessoas que se registraram em /admin/registrar e aguardam aprovação.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-amber-200/60">
            {pedidos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.nome ?? "Sem nome"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.email} · pediu em {formatarData(p.solicitou_admin_em)}
                  </p>
                </div>
                {p.email && <AcoesPedido usuarioId={p.id} email={p.email} />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cadastrar administrador</CardTitle>
          <CardDescription>A pessoa entra em /admin/entrar com o e-mail e a senha definidos aqui.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormNovoAdmin />
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar a lista. Recarregue a página.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="hidden md:table-cell">Desde</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(admins ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nome ?? "Sem nome"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatarData(a.criado_em)}</TableCell>
                  <TableCell className="text-right">
                    {a.id === usuarioId ? (
                      <span className="text-sm text-muted-foreground">Você</span>
                    ) : (
                      a.email && <BotaoRemover email={a.email} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
