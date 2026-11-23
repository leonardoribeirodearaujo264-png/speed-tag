This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## E-mails de acesso e recuperação

O Supabase Auth emite os links de acesso e recuperação. Para enviá-los pelo Resend, verifique o domínio remetente no Resend e configure SMTP personalizado no Supabase Auth.

| Campo | Valor |
| --- | --- |
| Servidor SMTP | `smtp.resend.com` |
| Porta | `465` |
| Usuário | `resend` |
| Senha | Chave de envio do Resend, guardada no painel do Supabase |
| Remetente | Endereço no domínio verificado, por exemplo `acesso@speedtag.online` |

Configure a URL pública do Supabase Auth como `https://www.speedtag.online`. Permita o retorno em `https://www.speedtag.online/auth/confirmar` e `https://speedtag.online/auth/confirmar` enquanto os dois endereços servirem o aplicativo. O retorno usa o mesmo endereço do navegador para manter o cookie de autenticação. No desenvolvimento, permita também a URL local de retorno configurada em `AUTH_REDIRECT_SITE_URL`. Use os modelos de e-mail do Supabase com `{{ .ConfirmationURL }}` e mantenha o rastreamento de cliques desativado no Resend para estes links.

Se o domínio usar `send.speedtag.online` para outro provedor, configure um subdomínio de retorno exclusivo no Resend e publique os registros MX e TXT exibidos por ele nesse subdomínio.

[SMTP no Resend](https://resend.com/changelog/smtp-service) · [SMTP personalizado no Supabase](https://supabase.com/docs/guides/auth/auth-smtp)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
