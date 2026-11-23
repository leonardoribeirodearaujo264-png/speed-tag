# Prompt: Placa de Avaliação Google (NFC + QR Code) com Next.js, Vercel e Supabase

Cole este documento inteiro no Claude Code (ou outro agente) dentro de uma pasta vazia. Ele descreve o produto, a arquitetura, o banco, as rotas, as telas, a segurança e as etapas de entrega com critérios de aceite.

---

## 1. Contexto do produto

Vendemos placas físicas (acrílico/PVC) com chip NFC e QR Code impressos. O cliente final (dono de um comércio) coloca a placa no balcão. O consumidor aproxima o celular ou lê o QR Code e cai direto no formulário "escrever avaliação" do Google daquele comércio.

**Toda placa nasce dentro do aplicativo.** O admin cria a placa (ou um lote) no painel; o app gera o **código único** (ex.: `1LG1`), a URL da placa, o **QR Code** pronto para impressão e permite **gravar o chip NFC** pelo próprio celular. Nenhuma placa existe fora do sistema: código digitado ou QR que não foi criado no app cai na página "placa indisponível".

O chip e o QR guardam sempre a mesma URL fixa, por exemplo `https://dominio.com/t/1LG1`. Quem decide para onde a placa leva é o nosso servidor, nunca o chip. Por isso:

- o chip pode ser gravado e **travado (lock)** na fábrica, e ninguém consegue regravar;
- o destino pode ser trocado depois pelo painel, sem mexer na placa;
- toda leitura passa pelo nosso servidor e vira estatística.

### Fluxo que o app precisa reproduzir (observado no produto de referência)

1. Cliente recebe a placa, aproxima o celular ou lê o QR.
2. Placa ainda não ativada: abre a tela **"Qual sua empresa?"** (idiomas PT, EN, ES no topo, botão "Entrar" no canto).
3. Ele digita o nome da empresa como está no Google. Aparece a lista de resultados (nome + endereço) e uma dica: "Não encontrou de primeira? Acrescente a cidade ou o bairro ao nome da empresa para refinar a busca."
4. Ao tocar num resultado, abre o cartão **"Confirmar: esse é o Google correto para ativação?"** com nome, total de avaliações, nota em estrelas, endereço e telefone. Botões **"Ativar produto agora"** e **"Voltar"**, e o link "Precisa de ajuda?".
5. Alternativa **"Não encontrou seu negócio?"**: campos "Nome da empresa" e "Link de avaliação" (cola o link copiado do Google Maps), com prévia "Aguardando link de avaliação".
6. Ativou: a partir daí, toda leitura da placa redireciona direto para a página de avaliação do Google da empresa.

---

## 2. Stack (obrigatória)

- **Next.js** (App Router, versão estável atual) + **TypeScript** estrito + **React Server Components**.
- **Tailwind CSS** + **shadcn/ui** para componentes; ícones `lucide-react`.
- **Supabase**: Postgres, Auth (link mágico por e-mail e login Google), RLS em todas as tabelas, migrations versionadas em `supabase/migrations`.
- **Vercel**: hospedagem, variáveis de ambiente, domínio curto próprio para as placas.
- **Google Places API (New)**: Autocomplete (New) + Place Details (New), chamadas **somente no servidor**.
- **Zod** para validar toda entrada; **next-intl** para PT/EN/ES.
- **qrcode** (npm) para gerar o QR no servidor; **Web NFC API** do navegador para gravar o chip (sem biblioteca).
- Testes: **Vitest** (unitários) e **Playwright** (ponta a ponta).

Não instalar nada fora desta lista sem justificar.

---

## 3. Arquitetura

```
Celular (NFC/QR)
   |
   v
GET /t/{codigo}  (Route Handler, runtime Node, sem cache)
   |-- placa ativa      -> 302 para destino_url + registra leitura com after()
   |-- placa nao_ativada -> 302 para /ativar/{codigo}
   |-- bloqueada / inexistente -> página de erro amigável

/ativar/{codigo}  (página pública, i18n)
   |-- digita nome -> GET /api/places/autocomplete  (servidor -> Google)
   |-- escolhe     -> GET /api/places/detalhes       (servidor -> Google)
   |-- confirma    -> POST /api/placas/{codigo}/ativar
   |                   -> RPC ativar_placa() no Postgres (transação atômica)
   |-- manual      -> POST /api/placas/{codigo}/ativar-manual (valida link Google)

/painel  (cliente logado)    -> suas placas, leituras, trocar destino
/admin   (papel admin)        -> CRIA a placa: código + QR + arte + gravação NFC; lotes, bloqueio
```

Ciclo de vida de uma placa: **criada no app (admin)** -> QR impresso e NFC gravado -> `nao_ativada` -> cliente ativa -> `ativa` -> (opcional) `bloqueada` ou resetada.

Princípios:

- A chave do Google e a `service_role` do Supabase **nunca** vão para o navegador.
- Rotas públicas (`/t`, `/ativar`, `/api/places/*`, ativação) usam o cliente Supabase do servidor com funções `SECURITY DEFINER` bem restritas; as tabelas não têm política de leitura pública.
- O redirecionamento `/t/{codigo}` precisa ser rápido: uma consulta por índice único, gravação da leitura fora do caminho crítico com `after()` do `next/server`.

---

## 4. Banco de dados (Supabase / Postgres)

### Tipos

```sql
create type status_placa as enum ('nao_ativada', 'ativa', 'bloqueada');
create type origem_empresa as enum ('google_places', 'manual');
create type origem_leitura as enum ('nfc', 'qr', 'desconhecida');
create type papel_usuario as enum ('cliente', 'admin');
```

### Tabelas

**perfis**
- `id uuid pk references auth.users on delete cascade`
- `nome text`, `email text`
- `papel papel_usuario not null default 'cliente'`
- `criado_em timestamptz default now()`

**lotes** (produção de placas)
- `id uuid pk default gen_random_uuid()`
- `nome text not null` (ex.: "Lote nov/2026 - 500 un.")
- `quantidade int not null check (quantidade between 1 and 10000)`
- `revendedor text null`
- `criado_por uuid references perfis`, `criado_em timestamptz default now()`

**empresas**
- `id uuid pk`
- `dono_id uuid null references perfis`
- `origem origem_empresa not null`
- `google_place_id text null` (pode ser guardado sem prazo pelos termos do Google)
- `nome text not null`
- `link_avaliacao text not null`
- `criado_em`, `atualizado_em`
- Índice único parcial: `(dono_id, google_place_id) where google_place_id is not null`, para o mesmo dono não duplicar a mesma empresa ao ativar várias placas.

Endereço, telefone, nota e total de avaliações **não** são gravados de forma permanente: são buscados no Google na hora de exibir (respeitar os termos de uso da Places API sobre armazenamento de conteúdo). Se precisar de cache, usar uma tabela `cache_places` com expiração curta e conferir o prazo permitido nos termos vigentes.

**placas**
- `id uuid pk`
- `codigo text not null unique` (ver regra de geração abaixo)
- `lote_id uuid references lotes`
- `status status_placa not null default 'nao_ativada'`
- `empresa_id uuid null references empresas`
- `dono_id uuid null references perfis`
- `destino_url text null`
- `email_ativacao text null` (e-mail informado na ativação, para o cliente reivindicar a placa depois)
- `criada_por uuid references perfis` (admin que criou a placa no app)
- `nfc_gravado_em timestamptz null`, `nfc_travado boolean not null default false`
- `ativada_em timestamptz null`, `criado_em`, `atualizado_em`
- `check ((status = 'ativa') = (destino_url is not null))`

**leituras**
- `id bigint generated always as identity pk`
- `placa_id uuid not null references placas on delete cascade`
- `ocorrida_em timestamptz not null default now()`
- `origem origem_leitura not null`
- `dispositivo text` (mobile/desktop, derivado do user agent)
- `pais text null` (cabeçalho `x-vercel-ip-country`)
- Sem IP bruto e sem user agent completo (LGPD).
- Índice `(placa_id, ocorrida_em desc)`.

**historico_placa** (auditoria)
- `id bigint identity pk`, `placa_id uuid`, `acao text` (`criou`, `gravou_nfc`, `travou_nfc`, `ativou`, `trocou_destino`, `bloqueou`, `desbloqueou`, `resetou`, `reivindicou`)
- `antes jsonb`, `depois jsonb`, `ator_id uuid null`, `criado_em`

### Geração de códigos

- Alfabeto Crockford Base32 sem caracteres ambíguos (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`), 6 caracteres (~1 bilhão de combinações, evita adivinhar códigos vizinhos).
- Gerados com `crypto.getRandomValues` no servidor, inseridos em lote com `on conflict (codigo) do nothing` e repetição até completar a quantidade.
- Busca do código sempre normalizada para maiúsculas, aceitando `O` como `0` e `I/L` como `1`.

### Funções (RPC)

`ativar_placa(p_codigo text, p_origem origem_empresa, p_place_id text, p_nome text, p_link text, p_email text)`:
- `SECURITY DEFINER`, `set search_path = public`.
- Em uma transação: cria ou reaproveita a empresa, faz `update placas set status='ativa', ... where codigo = p_codigo and status = 'nao_ativada' returning *`.
- Se nenhuma linha voltar: placa já ativada, bloqueada ou inexistente. Retorna erro tipado (`JA_ATIVADA`, `BLOQUEADA`, `NAO_ENCONTRADA`). Isso impede ativação dupla mesmo com dois toques simultâneos.
- Grava `historico_placa`.

`registrar_leitura(p_codigo text, p_origem origem_leitura, p_dispositivo text, p_pais text)`.

`trocar_destino(p_placa_id uuid, ...)`: só o dono ou admin; grava histórico.

### RLS

- `perfis`: usuário lê e edita só o próprio registro; admin lê todos.
- `placas`, `empresas`: `select/update` onde `dono_id = auth.uid()`; admin tudo. Sem `insert` para clientes (placas só nascem pelo admin).
- `leituras`: cliente lê só leituras das próprias placas; ninguém insere direto (só a função).
- `lotes`, `historico_placa`: só admin.
- Função auxiliar `eh_admin()` `SECURITY DEFINER` usada nas políticas.
- Trigger em `auth.users` cria o `perfil`.
- Trigger pós-login: placas com `email_ativacao` igual ao e-mail confirmado do usuário e `dono_id` nulo passam para ele (reivindicação), com histórico.

---

## 5. Integração Google Places (New)

- `GET /api/places/autocomplete?q=&sessao=&idioma=`
  - Chama `places:autocomplete` com `includedRegionCodes` (padrão `br`, configurável), `languageCode` do idioma da tela e `sessionToken` gerado no cliente (UUID por tentativa de busca).
  - Retorna só `placeId`, nome principal e texto secundário (endereço).
  - Debounce de 300 ms no cliente, mínimo de 3 caracteres, cancelar requisição anterior com `AbortController`.
- `GET /api/places/detalhes?placeId=&sessao=`
  - Chama Place Details com o **mesmo** `sessionToken` (encerra a sessão de cobrança) e field mask mínima: `id,displayName,formattedAddress,nationalPhoneNumber,rating,userRatingCount,googleMapsUri`.
- Link de avaliação montado no servidor: `https://search.google.com/local/writereview?placeid={placeId}`.
- Field mask é obrigatória na API nova. Os campos `rating` e `userRatingCount` sobem o SKU cobrado: confirmar o preço atual nas páginas oficiais "Place Data Fields" e "Usage and Billing" antes de ir para produção e configurar cota diária e alerta de orçamento no Google Cloud.
- Chave restrita à Places API (New) e usada só no servidor.
- Tratar `ZERO_RESULTS`, cota excedida e timeout (5 s) com mensagens claras, sem quebrar a tela.

### Ativação manual ("Não encontrou seu negócio?")

- Aceitar só links do Google: `search.google.com`, `www.google.com/maps`, `maps.google.com`, `g.page`, `maps.app.goo.gl`, `goo.gl/maps`.
- Links curtos são resolvidos no servidor (seguir redirecionamentos, máximo 5, timeout 5 s) e o domínio final precisa continuar sendo Google. Se der para extrair o `place_id`, converter para o link `writereview`.
- Nunca redirecionar a placa para domínio fora da lista (evita uso da placa para phishing).

---

## 6. Rotas e telas

### Públicas

| Rota | Função |
|---|---|
| `/t/[codigo]` | Redirecionamento. `?o=q` no QR identifica origem QR; sem parâmetro conta como NFC. `Cache-Control: no-store`. |
| `/ativar/[codigo]` | Fluxo de ativação (busca, confirmação, manual, sucesso). |
| `/ativar/[codigo]/sucesso` | "Placa ativada" + botão "Testar agora" (abre o link de avaliação) + convite para criar conta e acompanhar leituras. |
| `/ajuda` | Passo a passo com prints: como achar a empresa, como copiar o link no Maps. |
| `/entrar` | Supabase Auth (link mágico e Google). |
| `/placa-indisponivel` | Placa bloqueada ou código inválido, com contato do suporte. |

### Cliente (`/painel`, exige login)

- Lista de placas: código, empresa, status, leituras nos últimos 7 e 30 dias.
- Detalhe da placa: gráfico de leituras por dia (NFC vs QR), trocar empresa/destino (refaz busca no Google, com confirmação), histórico.
- Vincular placa nova pelo código (ativação já logada).

### Admin (`/admin`, papel admin)

- **Criar placa** (uma) ou **criar lote** (quantidade): ver seção 6.1.
- Lista de placas com filtro por lote, status e "NFC gravado / não gravado"; busca por código.
- Detalhe da placa: QR, URL, botões de download, gravar NFC, bloquear, desbloquear, **resetar** (volta para `nao_ativada`, limpa empresa e dono, com motivo obrigatório).
- Visão geral: placas por status, ativações por dia, leituras totais.

### 6.1 Criação da placa e do QR Code (dentro do app)

Esse é o ponto de partida de todo o sistema: sem placa criada aqui, não existe QR nem NFC válido.

**Criar placa única** (`/admin/placas/nova`)
1. Admin clica "Criar placa" e escolhe o lote (ou "sem lote") e, opcionalmente, já vincula a um cliente/empresa (venda direta já configurada).
2. O servidor gera o código (seção 4), grava a placa como `nao_ativada` e devolve a tela da placa criada com:
   - código em destaque;
   - URL do NFC: `https://dominio.com/t/{codigo}`;
   - URL do QR: `https://dominio.com/t/{codigo}?o=q`;
   - **prévia do QR Code** e **prévia da arte da placa** (moldura "Avalie no Google", estrelas, logo G, ícone de aproximação NFC, QR no canto, código pequeno impresso embaixo do QR para suporte).
3. Ações: **Baixar QR (SVG e PNG 1024 px)**, **Baixar arte da placa (PNG/PDF para impressão)**, **Copiar URL**, **Gravar NFC**.

**Criar lote** (`/admin/lotes/novo`)
- Quantidade (1 a 10.000), nome do lote, revendedor opcional.
- Gera todos os códigos de uma vez e oferece: CSV (`codigo, url_nfc, url_qr`), ZIP com um SVG de QR por placa (nome do arquivo = código) e **folha de impressão** (página HTML com CSS `@page`, várias artes por folha A4, marcas de corte), para mandar à gráfica.

**Geração do QR**
- Feita no servidor com a biblioteca `qrcode` (SVG e PNG), correção de erro nível **M** ou **Q** (aguenta arranhão e reflexo no acrílico), margem de 4 módulos, cor escura sobre fundo claro (QR invertido falha em muitos leitores).
- Rota `GET /api/admin/placas/{codigo}/qr?formato=svg|png&tamanho=` protegida por papel admin. O QR **não é guardado como arquivo**: é sempre gerado a partir do código, então nunca fica desatualizado.
- Teste automático: o QR gerado é decodificado no teste e precisa devolver exatamente a URL da placa.

**Gravação do NFC pelo app**
- Botão "Gravar NFC" usa a **Web NFC API** (`NDEFReader.write` com registro `url`), disponível no Chrome para Android. O admin encosta o chip no celular e o app grava a URL do NFC da placa.
- Depois de gravar, o app lê o chip de volta (`NDEFReader.scan`) e confere se a URL bate; se bater, oferece **"Travar chip"** (`makeReadOnly()`), com aviso de que é irreversível.
- Grava na placa `nfc_gravado_em` e `nfc_travado` e registra no histórico (`gravou_nfc`, `travou_nfc`).
- Em navegador sem Web NFC (iPhone, desktop): esconder o botão, mostrar a URL para copiar e instrução de gravar com app de terceiros (ex.: NFC Tools), mais o CSV do lote para gravação em massa.
- Chip recomendado: NTAG213 ou superior (a URL curta cabe com folga).

### Requisitos de interface

- Mobile first (o uso real é no celular, em pé, com uma mão). Botões com no mínimo 44 px, fonte de entrada 16 px (evita zoom no iOS).
- Visual premium e limpo: fundo com gradiente azul da marca, cartão branco central, estrelas douradas na confirmação, tipografia com hierarquia clara.
- Estados obrigatórios em cada tela: carregando (skeleton na lista de resultados), vazio ("Nenhuma empresa encontrada, tente incluir a cidade"), erro (com botão de tentar de novo), sucesso.
- Seletor PT/EN/ES persistido em cookie; idioma inicial pelo `Accept-Language`.
- Acessibilidade: foco visível, `aria-live` na lista de resultados, contraste AA, navegação por teclado.

---

## 7. Segurança

- Limite de requisições por IP nas rotas `/api/places/*` e de ativação (regra de rate limit do Vercel Firewall, ou tabela no Postgres com janela deslizante). Isso protege a cota paga do Google.
- Ativação idempotente e atômica (seção 4).
- Placa ativada só muda de destino pelo dono logado ou pelo admin; a tela pública de ativação nunca sobrescreve placa ativa.
- Validar `codigo` com Zod (6 caracteres do alfabeto) antes de tocar no banco.
- Cabeçalhos de segurança (CSP, `X-Frame-Options`, `Referrer-Policy`) no `next.config`.
- Lista de domínios permitidos para destino (seção 5).
- Logs de erro sem dados pessoais.

---

## 8. Variáveis de ambiente

```
NEXT_PUBLIC_SITE_URL=            # domínio curto das placas
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=       # só servidor
GOOGLE_PLACES_API_KEY=           # só servidor
PLACES_REGIAO_PADRAO=br
```

Criar `.env.example` com essas chaves vazias e validar todas na inicialização com Zod (`src/lib/env.ts`), falhando com mensagem clara se faltar alguma.

---

## 9. Estrutura de pastas

```
src/
  app/
    t/[codigo]/route.ts
    [locale]/ativar/[codigo]/page.tsx
    [locale]/ativar/[codigo]/sucesso/page.tsx
    [locale]/painel/...
    [locale]/admin/...
    api/places/autocomplete/route.ts
    api/places/detalhes/route.ts
    api/placas/[codigo]/ativar/route.ts
    api/placas/[codigo]/ativar-manual/route.ts
  components/ativacao/   (BuscaEmpresa, ListaResultados, CartaoConfirmacao, FormManual, SeletorIdioma)
  components/painel/
  components/admin/      (FormNovaPlaca, FormNovoLote, PreviaQr, PreviaArtePlaca, GravarNfc, FolhaImpressao)
  app/api/admin/placas/route.ts            (POST cria placa)
  app/api/admin/lotes/route.ts             (POST cria lote)
  app/api/admin/placas/[codigo]/qr/route.ts
  app/api/admin/lotes/[id]/exportar/route.ts (CSV e ZIP)
  lib/qr.ts                (geração do QR a partir do código)
  lib/nfc.ts               (wrapper tipado da Web NFC, detecção de suporte)
  lib/
    env.ts
    supabase/servidor.ts, supabase/navegador.ts
    google/places.ts         (cliente tipado da Places API)
    google/link-avaliacao.ts (montagem e validação de links)
    codigos.ts               (geração e normalização)
    validacao.ts             (schemas Zod)
  messages/pt.json, en.json, es.json
supabase/
  migrations/
  seed.sql                   (1 admin de teste, 1 lote, 5 placas)
tests/
  unit/, e2e/
```

---

## 10. Etapas de entrega (uma por vez, com aprovação)

**Etapa 1. Base e banco**
Projeto Next + Tailwind + shadcn, Supabase local (`supabase start`), migrations da seção 4, RLS, seed, `env.ts`.
Aceite: `supabase db reset` sobe sem erro; testes de RLS provam que um cliente não lê placa de outro.

**Etapa 2. Criação da placa no app (admin)**
Login admin, criar placa única e lote, geração do código, QR (SVG/PNG), arte da placa, folha de impressão, CSV/ZIP, gravação e travamento do NFC por Web NFC.
Aceite: placa criada aparece na lista como `nao_ativada`; o QR baixado, lido pela câmera do celular, abre a URL da placa; gravação NFC testada em Android com chip real e conferida por leitura de volta.

**Etapa 3. Redirecionamento**
`/t/[codigo]` com os três desfechos e registro de leitura.
Aceite: placa ativa responde 302 para o destino; leitura gravada com origem correta; código que não foi criado no app mostra página amigável.

**Etapa 4. Ativação com Google**
Busca, lista, confirmação, ativação atômica, sucesso, i18n.
Aceite: ativação real com uma empresa existente no Google; dois POSTs simultâneos resultam em uma ativação e um `JA_ATIVADA`.

**Etapa 5. Ativação manual**
Formulário, resolução de link curto, lista de domínios permitidos.
Aceite: `maps.app.goo.gl/...` real é aceito; link de domínio externo é recusado.

**Etapa 6. Painel do cliente**
Login, reivindicação por e-mail, lista, gráfico, troca de destino com histórico.

**Etapa 7. Admin completo**
Visão geral, bloquear, desbloquear, resetar com motivo, filtros e busca.

**Etapa 8. Produção**
Projeto Supabase de produção, variáveis na Vercel, domínio curto, rate limit, cota e alerta no Google Cloud, teste com placa NFC física e QR impresso.

---

## 11. Validação obrigatória em cada etapa

- `npm run build`, `npm run lint`, `tsc --noEmit`, `npm test` passando.
- Playwright cobrindo: admin cria placa e baixa o QR; placa não ativada abre ativação; busca mostra resultados; confirmar ativa; segunda leitura redireciona; placa bloqueada mostra erro. Nos testes E2E a Places API pode ser substituída por fixture **apenas no ambiente de teste**; em desenvolvimento e produção a integração é real.
- Nunca simular sucesso para esconder integração quebrada. Se uma etapa não puder ser testada de verdade (ex.: falta a chave do Google), dizer exatamente o que ficou sem teste.

---

## 12. Fora do escopo da v1 (anotar para depois)

- Pagamento e loja das placas.
- Painel de revendedor com seus próprios lotes.
- Perguntar a nota antes de mandar para o Google (filtrar avaliações negativas): **não implementar**, porque a política do Google proíbe solicitar avaliações de forma seletiva ("review gating") e pode levar à remoção de avaliações da empresa.
- Respostas automáticas às avaliações (exige Google Business Profile API e aprovação do Google).
