# Speed Tag: especificação e roteiro

Especificação definida pela dona do projeto em 23/11/2026. Ela prevalece sobre o `PROMPT.md` onde os dois divergirem.

## Regras essenciais

1. Cada plaquinha tem um identificador exclusivo, gerado pelo sistema antes da entrega.
2. Só o administrador cria, apaga e distribui plaquinhas. O usuário ativa apenas as unidades **atribuídas à conta dele**.
3. Cada plaquinha fica vinculada a uma empresa por vez; uma empresa pode ter várias plaquinhas.
4. O link gravado no NFC é permanente; o destino muda no Supabase.
5. A ativação exige login (ou código seguro), para terceiros não assumirem plaquinhas.
6. O sistema registra acessos, mas não afirma que cada acesso virou uma avaliação publicada.

## Painel do usuário (cliente)

- **Conta:** cadastro com nome, e-mail, telefone e senha; login; recuperação de senha; edição do perfil.
- **Dashboard:** total de plaquinhas, ativas e disponíveis, empresas, acessos e atividade recente.
- **Empresas:** cadastrar, editar, consultar e excluir; várias por usuário; nome, endereço, telefone, logotipo e link de avaliação.
- **Google Places:** busca com sugestões, escolha do estabelecimento, Place ID e link de avaliação; cadastro manual do link como alternativa.
- **Plaquinhas:** ativar (só as atribuídas), associar a uma empresa, alterar destino, desvincular, ver status, testar o redirecionamento.
- **QR Code e links:** QR individual, copiar link, baixar QR, compartilhar endereço de avaliação.
- **Relatórios:** acessos por plaquinha, empresas mais acessadas, períodos e histórico de redirecionamentos.

## Painel do administrador

- **Dashboard geral:** usuários, empresas, plaquinhas (cadastradas, ativas, disponíveis), acessos e indicadores.
- **Usuários:** criar contas, consultar, editar, bloquear e desbloquear, permissões, plaquinhas vinculadas.
- **Estoque NFC:** cadastro individual ou em lote, códigos exclusivos, disponíveis, reservar, atribuir a clientes, ativar e desativar.
- **Empresas:** consultar e editar todas, ver o responsável, verificar Place ID, corrigir vínculos.
- **Redirecionamentos:** URLs exclusivas, conferir destinos, suspender links, corrigir e ver histórico.
- **Configurações:** identidade visual, domínio, integrações, permissões, parâmetros e regras de ativação.
- **Relatórios:** crescimento de usuários, ativações, distribuição, acessos e uso, com filtros e exportação.
- **Auditoria:** ativações, mudanças de destino, alterações de cadastro, responsável por cada operação e tentativas de acesso não autorizadas.

## Google Places API (New): recursos usados

Autocomplete, Text Search, Place Details, Place ID, Review URI (`googleMapsLinks.writeAReviewUri`), Rating, User Rating Count, Place Photos e Business Status. Cada campo pedido muda o SKU cobrado: conferir preço antes de liberar em produção e configurar cota e alerta de gasto.

## Decisões técnicas já tomadas

- Banco compartilhado com a loja (mesmo projeto Supabase e mesmo login). Nada do app altera `auth.users` de forma que afete a loja; bloqueio e permissões valem só no app (`perfis`).
- Confirmação de e-mail desligada até o site ter domínio (`EXIGIR_CONFIRMACAO_EMAIL=false`). Recuperação de senha por e-mail também depende do domínio e de um SMTP próprio.
- Cada mudança de banco é entregue como um único arquivo SQL para rodar no SQL Editor.

## Roteiro

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Base, banco, RLS | Feita |
| 2 | Criação de placas, QR, arte, NFC, lotes | Feita |
| 2b | Login e registro de admin, aprovação, marca Speed Tag | Feita |
| 3 | Painel admin: início, usuários, apagar placa, exemplos | Feita |
| 4 | Estoque com atribuição: status em estoque, reservada, atribuída, ativa, desativada; admin atribui (uma placa ou N do lote), reserva, devolve, desativa e reativa; ativação só logado e só da placa atribuída; tentativa negada vai para o histórico | Feita |
| 5 | Redirecionamento `/t/[codigo]` com registro de acesso e tentativas inválidas; admin cria conta de cliente | Feita |
| 5b | Preparar NFC (feito pelo Codex, revisado): tag criada, gravada, testada, entregue (código secreto) e ativada; `/ativar/[codigo]` com login e busca no Google Places; vale também para placa de lote atribuída | Feita (rodar migration 0010) |
| 6 | Painel do cliente: cadastro com telefone e senha, dashboard, empresas (várias, com logotipo), plaquinhas, QR e links | Pendente |
| 7 | Google Places: autocomplete, detalhes, Place ID, link de avaliação, nota e total | Pendente (chave já no `.env.local`) |
| 8 | Admin: empresas, redirecionamentos, relatórios com exportação, auditoria completa | Pendente |
| 9 | Configurações da plataforma, domínio, SMTP, confirmação de e-mail e recuperação de senha | Pendente |
| 10 | Produção na Vercel | Pendente |
