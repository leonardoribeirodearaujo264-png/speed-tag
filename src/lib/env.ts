import { z } from "zod";

/**
 * Variáveis de ambiente validadas. As públicas podem ir para o navegador;
 * as do servidor só são lidas por envServidor(), que nunca deve ser
 * importado em componente cliente.
 */
const esquemaPublico = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const esquemaServidor = esquemaPublico.extend({
  SUPABASE_SECRET_KEY: z.string().min(20),
});

// Separado: o Google só entra na ativação (Etapa 4); o resto do app não depende dele.
const esquemaGoogle = z.object({
  GOOGLE_PLACES_API_KEY: z.string().min(20),
  PLACES_REGIAO_PADRAO: z
    .string()
    .regex(/^[a-z]{2}$/, "use o código do país em minúsculas, ex.: br")
    .default("br"),
});

export type EnvPublico = z.infer<typeof esquemaPublico>;
export type EnvServidor = z.infer<typeof esquemaServidor>;
export type EnvGoogle = z.infer<typeof esquemaGoogle>;

function validar<T extends z.ZodType>(esquema: T, valores: Record<string, unknown>): z.infer<T> {
  const resultado = esquema.safeParse(valores);
  if (!resultado.success) {
    const faltando = resultado.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${faltando}. Veja .env.example.`);
  }
  return resultado.data;
}

// O Next só embute NEXT_PUBLIC_* no bundle do cliente quando lidas por nome literal.
export function envPublico(): EnvPublico {
  return validar(esquemaPublico, {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

let cacheServidor: EnvServidor | undefined;

export function envServidor(): EnvServidor {
  if (typeof window !== "undefined") {
    throw new Error("envServidor() chamado no navegador");
  }
  cacheServidor ??= validar(esquemaServidor, process.env);
  return cacheServidor;
}

/**
 * Confirmação de e-mail no registro de admin. Desligada até o site ter domínio
 * próprio (decisão da dona do projeto). Com "false", o servidor cria a conta já
 * confirmada; a aprovação de um admin continua obrigatória. Não altera o Auth da loja.
 */
export function exigeConfirmacaoEmail(): boolean {
  return z.enum(["true", "false"]).default("false").catch("false").parse(process.env.EXIGIR_CONFIRMACAO_EMAIL) === "true";
}

let cacheGoogle: EnvGoogle | undefined;

export function envGoogle(): EnvGoogle {
  if (typeof window !== "undefined") {
    throw new Error("envGoogle() chamado no navegador");
  }
  cacheGoogle ??= validar(esquemaGoogle, process.env);
  return cacheGoogle;
}
