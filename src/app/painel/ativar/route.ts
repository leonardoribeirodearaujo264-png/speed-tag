import { NextResponse } from "next/server";
import { z } from "zod";
import { codigoValido, normalizarCodigo } from "@/lib/codigos";

export function GET(request: Request) {
  const url = new URL(request.url);
  const codigo = normalizarCodigo((url.searchParams.get("codigo") ?? "").slice(0, 20));
  const origem = url.searchParams.get("origem") === "empresas" ? "/painel/empresas" : "/painel";
  const empresa = z.uuid().safeParse(url.searchParams.get("empresa"));
  const id = origem === "/painel/empresas" && empresa.success ? empresa.data : null;
  if (!codigoValido(codigo)) return NextResponse.redirect(new URL(`${id ? `${origem}/${id}` : origem}?erro=codigo`, url));
  if (origem !== "/painel/empresas") return NextResponse.redirect(new URL(`/ativar/${codigo}`, url));

  const destino = new URL(origem, url);
  destino.searchParams.set("placa", codigo);
  if (id) destino.searchParams.set("empresa", id);
  return NextResponse.redirect(destino);
}
