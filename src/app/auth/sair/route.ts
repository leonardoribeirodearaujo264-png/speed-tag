import { NextResponse, type NextRequest } from "next/server";
import { caminhoInternoSeguro } from "@/lib/auth";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

export async function POST(request: NextRequest) {
  const dados = await request.formData().catch(() => null);
  const destino = caminhoInternoSeguro(dados?.get("destino")?.toString(), "/entrar");

  const supabase = await clienteSupabaseUsuario();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(destino, request.url), { status: 303 });
}
