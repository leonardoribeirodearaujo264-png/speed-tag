import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirAdmin } from "@/lib/auth";
import { FormNovaPlaca } from "./form-nova-placa";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Criar placa" };

export default async function NovaPlaca() {
  const { supabase } = await exigirAdmin("/admin/placas/nova");
  const { data: lotes } = await supabase
    .from("lotes")
    .select("id, nome")
    .order("criado_em", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Criar placa</CardTitle>
          <CardDescription>
            Gera o código único, o QR Code para impressão e a URL para gravar no chip NFC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormNovaPlaca lotes={lotes ?? []} />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Várias placas de uma vez?{" "}
        <Link href="/admin/lotes/novo" className="font-medium text-marca-texto hover:underline">
          Criar um lote
        </Link>
      </p>
    </div>
  );
}
