import { z } from "zod";
import { clienteSupabaseUsuario } from "@/lib/supabase/servidor";

const credencial = z.object({ email: z.email().max(254), token: z.string().trim().regex(/^\d{6,10}$/) });

export async function verificarCodigoEmail(email: string, codigo: FormDataEntryValue | null, tipo: "email" | "recovery") {
  const entrada = credencial.safeParse({ email, token: codigo });
  if (!entrada.success) return { erro: "Informe o código numérico recebido por e-mail." } as const;

  const supabase = await clienteSupabaseUsuario();
  const { data, error } = await supabase.auth.verifyOtp({ ...entrada.data, type: tipo });
  if (error || !data.session || !data.user) {
    console.error("[auth/codigo] verificação", tipo, error?.status, error?.code);
    return { erro: error?.status === 429
      ? "Muitas tentativas. Aguarde e tente novamente."
      : "Código inválido ou expirado. Confira o código mais recente ou solicite outro." } as const;
  }

  const perfil = await supabase.rpc("garantir_perfil");
  if (perfil.error) {
    console.error("[auth/codigo] perfil", perfil.error.code);
    return { erro: "A conta foi confirmada, mas não foi possível abrir o perfil. Tente entrar novamente." } as const;
  }
  return { supabase } as const;
}
