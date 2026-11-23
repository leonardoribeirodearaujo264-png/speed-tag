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
  // Teto de chamadas ao Google por dia (todas as telas somadas): controle de custo.
  GOOGLE_LIMITE_DIARIO: z.coerce.number().int().min(0).max(1_000_000).default(2000),
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

const HOSTS_LOCAIS = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/;

/**
 * Endereço público do site, usado nas URLs gravadas no NFC e impressas no QR e no
 * retorno do login. Na produção da Vercel, um NEXT_PUBLIC_SITE_URL local (copiado do
 * .env.local por engano) é trocado pelo domínio de produção que a própria Vercel
 * informa, porque uma tag gravada com localhost nunca funcionaria para o cliente.
 */
export function urlDoSite(): string {
  const configurada = envPublico().NEXT_PUBLIC_SITE_URL;
  const producaoVercel = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  if (producaoVercel && HOSTS_LOCAIS.test(new URL(configurada).hostname)) {
    return `https://${producaoVercel}`;
  }
  return configurada.replace(/\/+$/, "");
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
