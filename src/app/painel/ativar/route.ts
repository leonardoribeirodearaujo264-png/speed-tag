import { NextResponse } from "next/server";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";

export function GET(request: Request) {
  const url = new URL(request.url);
  const codigo = normalizarCodigo((url.searchParams.get("codigo") ?? "").slice(0, 20));
  const origem = url.searchParams.get("origem") === "empresas" ? "/painel/empresas" : "/painel";
  if (!codigoValido(codigo)) return NextResponse.redirect(new URL(`${origem}?erro=codigo`, url));
  const destino = origem === "/painel/empresas" ? `${origem}?placa=${codigo}` : `/ativar/${codigo}`;
  return NextResponse.redirect(new URL(destino, url));
}
