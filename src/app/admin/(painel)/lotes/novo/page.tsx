import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirAdmin } from "@/lib/auth";
import { FormNovoLote } from "./form-novo-lote";

// Painel com login: navegação espera o servidor (sessão lida a cada requisição).
export const instant = false;


export const metadata = { title: "Criar lote" };

export default async function NovoLote() {
  await exigirAdmin("/admin/lotes/novo");

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">Criar lote</CardTitle>
        <CardDescription>
          Gera todos os códigos de uma vez. Depois exporte a planilha, os QR Codes e a folha de impressão para a gráfica.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormNovoLote />
      </CardContent>
    </Card>
  );
}
