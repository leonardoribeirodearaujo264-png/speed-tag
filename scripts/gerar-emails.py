"""Gera os modelos de e-mail do Supabase Auth em português (supabase/templates).

Um layout só para todos: cabeçalho escuro com a logo, texto, código (quando há) e botão.

O botão usa {{ .ConfirmationURL }}: o Supabase valida o token (uso único, com validade) e volta
para <site>/auth/confirmar. O app pede os e-mails sem PKCE, então a sessão volta no endereço e a
página /auth/confirmar a grava: funciona em qualquer navegador (o app do Gmail, por exemplo).

Uso: python scripts/gerar-emails.py
Depois cole cada arquivo em Supabase > Authentication > Emails (assunto em ASSUNTOS.md).
"""
from pathlib import Path

# Cabeçalho inteiro é uma imagem (fundo preto + logo azul): o modo escuro do Gmail não tem cor para inverter.
LOGO = "https://www.speedtag.online/marca/speedtag-email-cabecalho.png"
SITE = "https://www.speedtag.online"


def link(_tipo: str) -> str:
    # Link padrão do Supabase: valida o token (uso único, com validade) e volta para
    # <site>/auth/confirmar. Funciona com qualquer versão do app publicada.
    return "{{ .ConfirmationURL }}"


def paragrafo(texto: str, extra: str = "") -> str:
    return f'<tr><td style="padding:8px 32px 8px;font-size:15px;line-height:1.6;color:#334155{extra}">{texto}</td></tr>'


def codigo() -> str:
    return ('<tr><td style="padding:8px 32px 4px"><div style="background:#f1f5ff;border:1px solid #dbe4ff;border-radius:14px;'
            'padding:18px;text-align:center;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:700;'
            'letter-spacing:8px;color:#0b1020">{{ .Token }}</div></td></tr>')


def botao(rotulo: str, tipo: str) -> str:
    return (f'<tr><td style="padding:24px 32px 8px" align="center"><a href="{link(tipo)}" '
            'style="display:inline-block;background:#1767ff;color:#ffffff;text-decoration:none;font-weight:700;'
            f'font-size:16px;letter-spacing:0.02em;padding:15px 30px;border-radius:12px">{rotulo}</a></td></tr>')


def nota(texto: str) -> str:
    return f'<tr><td style="padding:8px 32px 0;font-size:13px;line-height:1.5;color:#64748b;text-align:center">{texto}</td></tr>'


def titulo(texto: str) -> str:
    return f'<tr><td style="padding:32px 32px 8px"><h1 style="margin:0;font-size:22px;line-height:1.3;color:#0b1020">{texto}</h1></td></tr>'


def layout(titulo_pagina: str, corpo: str) -> str:
    return "".join([
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        f'<title>{titulo_pagina}</title></head>',
        '<body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px"><tr><td align="center">',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden">',
        f'<tr><td style="padding:0;line-height:0;font-size:0" align="center"><a href="{SITE}" style="display:block"><img src="{LOGO}" width="520" alt="Speed Tag" style="display:block;width:100%;max-width:520px;height:auto;border:0;outline:none;text-decoration:none"></a></td></tr>',
        corpo,
        '<tr><td style="padding:28px 32px 32px;font-size:13px;line-height:1.6;color:#64748b">'
        'Se você não fez este pedido, ignore esta mensagem. Sua conta continua segura.</td></tr>',
        '</table>',
        f'<p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Speed Tag · Placas NFC e QR Code para avaliações no Google · <a href="{SITE}" style="color:#64748b">speedtag.online</a></p>',
        '</td></tr></table></body></html>\n',
    ])


NOTA_LINK = "O botão funciona uma única vez e expira em pouco tempo."

# Cadastro: quem ativou pela placa (sem senha) cria a senha; quem se cadastrou no site só confirma.
CONFIRMAR_CADASTRO = "".join([
    "{{ if .Data.senha_pendente }}",
    titulo("Olá!"),
    paragrafo("O cadastro da sua plaquinha Speed Tag foi realizado com sucesso."),
    paragrafo("Para confirmar seu e-mail, criar sua senha e acessar seu painel de gerenciamento, clique no botão abaixo."),
    botao("CRIAR MINHA SENHA", "email"),
    nota(NOTA_LINK),
    paragrafo("No seu painel, você poderá gerenciar suas plaquinhas, editar suas empresas e atualizar seus links de avaliação.", ";padding-top:24px"),
    paragrafo("Equipe Speed Tag."),
    "{{ else }}",
    titulo("Olá{{ if .Data.nome }}, {{ .Data.nome }}{{ end }}!"),
    paragrafo("Sua conta Speed Tag foi criada com sucesso."),
    paragrafo("Para confirmar seu e-mail e acessar seu painel de gerenciamento, clique no botão abaixo."),
    botao("CONFIRMAR MEU E-MAIL", "email"),
    nota(NOTA_LINK),
    paragrafo("No seu painel, você poderá gerenciar suas plaquinhas, editar suas empresas e atualizar seus links de avaliação.", ";padding-top:24px"),
    paragrafo("Equipe Speed Tag."),
    "{{ end }}",
])

MODELOS = {
    # arquivo: (modelo no Supabase, assunto, título da página, corpo)
    "confirmar-cadastro": ("Confirm sign up", "Bem-vindo ao Speed Tag! Finalize seu cadastro.", "Finalize seu cadastro", CONFIRMAR_CADASTRO),
    "codigo-acesso": ("Magic link or OTP", "Seu acesso ao Speed Tag", "Seu acesso", "".join([
        titulo("Confirme seu acesso"),
        paragrafo("Toque no botão para entrar no Speed Tag. Se você acabou de ativar uma plaquinha, ela entra na sua conta assim que você confirmar."),
        botao("ENTRAR NO SPEED TAG", "email"),
        nota(NOTA_LINK),
        paragrafo("Se preferir, digite este código na tela de acesso:", ";padding-top:24px"),
        codigo(),
    ])),
    "recuperar-senha": ("Reset password", "Redefina sua senha do Speed Tag", "Redefina sua senha", "".join([
        titulo("Redefina sua senha"),
        paragrafo("Recebemos um pedido para criar uma nova senha. Toque no botão ou digite o código abaixo na tela de recuperação."),
        botao("CRIAR NOVA SENHA", "recovery"),
        nota(NOTA_LINK),
        paragrafo("Código de recuperação:", ";padding-top:24px"),
        codigo(),
    ])),
    "trocar-email": ("Change email address", "Confirme seu novo e-mail no Speed Tag", "Confirme seu novo e-mail", "".join([
        titulo("Confirme seu novo e-mail"),
        paragrafo("Para trocar o e-mail da sua conta para {{ .NewEmail }}, confirme pelo botão abaixo."),
        botao("CONFIRMAR NOVO E-MAIL", "email_change"),
        nota(NOTA_LINK),
    ])),
    "convite": ("Invite user", "Você foi convidado para o Speed Tag", "Você foi convidado", "".join([
        titulo("Olá!"),
        paragrafo("Sua conta Speed Tag foi criada para gerenciar suas plaquinhas."),
        paragrafo("Para confirmar seu e-mail, criar sua senha e acessar seu painel, clique no botão abaixo."),
        botao("CRIAR MINHA SENHA", "invite"),
        nota(NOTA_LINK),
        paragrafo("Equipe Speed Tag.", ";padding-top:24px"),
    ])),
    "reautenticacao": ("Reauthentication", "Código de confirmação do Speed Tag", "Confirme que é você", "".join([
        titulo("Confirme que é você"),
        paragrafo("Para concluir a alteração na sua conta, digite o código abaixo."),
        codigo(),
    ])),
}

pasta = Path(__file__).resolve().parent.parent / "supabase" / "templates"
pasta.mkdir(parents=True, exist_ok=True)
linhas = ["# Assuntos dos e-mails (Supabase > Authentication > Emails)", "", "| Modelo no Supabase | Assunto | Arquivo |", "|---|---|---|"]
for arquivo, (modelo, assunto, titulo_pagina, corpo) in MODELOS.items():
    (pasta / f"{arquivo}.html").write_text(layout(titulo_pagina, corpo), encoding="utf-8", newline="\n")
    linhas.append(f"| {modelo} | {assunto} | `{arquivo}.html` |")
(pasta / "ASSUNTOS.md").write_text("\n".join(linhas) + "\n", encoding="utf-8", newline="\n")
print("ok", len(MODELOS))
