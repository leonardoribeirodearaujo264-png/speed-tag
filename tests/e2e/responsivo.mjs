// Verificação automatizada de responsividade e dos fluxos públicos (somente leitura).
//
// Como rodar (com o servidor de desenvolvimento já no ar em http://localhost:3210):
//   node tests/e2e/responsivo.mjs
// Com o C: sem espaço, mande os temporários do navegador para o D: (Git Bash):
//   mkdir -p /d/tmp-playwright && TEMP='D:\tmp-playwright' TMP='D:\tmp-playwright' node tests/e2e/responsivo.mjs
// Não grava vídeo nem trace; só as capturas PNG em tests/e2e/saida.
//
// O pacote "playwright" não é dependência do projeto: o script o carrega do cache do npx
// (D:\npm-cache\_npx\<hash>\node_modules\playwright, versão 1.65.1). Se ele ainda não estiver
// no cache, rode uma vez "npx -y playwright@1.65.1 --version". Para apontar outro caminho, use
// PLAYWRIGHT_DIR=<pasta do pacote playwright>. Se o Chromium da revisão do pacote não estiver
// baixado, o script usa o Chromium mais novo encontrado em %LOCALAPPDATA%\ms-playwright
// (ou CHROMIUM_PATH=<chrome.exe>). WebKit é usado só se estiver instalado.
//
// Variáveis opcionais: BASE_URL (padrão http://localhost:3210), PULAR_BUSCA=1 (não faz a busca
// do Google na ativação), CODIGO_PLACA=<código> (pula a consulta ao Supabase).
//
// Efeitos colaterais: nenhum registro é gravado. O único envio real é um login com credenciais
// inexistentes (naoexiste@example.com) e no máximo uma busca de empresa na ativação.

import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const SAIDA = path.join(AQUI, "saida");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3210";
const LARGURAS = [320, 375, 390, 430, 768, 1024, 1440];
const ALTURA = 800;
// O anunciador de rotas do Next também tem role=alert; fica de fora.
const ALERTA = "[role=alert]:not(#__next-route-announcer__)";

// ---------- carregamento do Playwright ----------
function localizarPlaywright() {
  if (process.env.PLAYWRIGHT_DIR) return process.env.PLAYWRIGHT_DIR;
  const cache = execSync("npm config get cache", { encoding: "utf8" }).trim();
  const npx = path.join(cache, "_npx");
  const candidatos = fs.existsSync(npx)
    ? fs.readdirSync(npx).map((h) => path.join(npx, h, "node_modules", "playwright")).filter((p) => fs.existsSync(path.join(p, "package.json")))
    : [];
  const versao = (p) => JSON.parse(fs.readFileSync(path.join(p, "package.json"), "utf8")).version;
  const exato = candidatos.find((p) => versao(p) === "1.65.1");
  if (exato) return exato;
  if (candidatos.length) return candidatos.sort((a, b) => versao(b).localeCompare(versao(a), undefined, { numeric: true }))[0];
  throw new Error('Pacote playwright não encontrado no cache do npx. Rode: npx -y playwright@1.65.1 --version');
}

const dirPlaywright = localizarPlaywright();
const { chromium, webkit, devices } = createRequire(path.join(dirPlaywright, "package.json"))("./index.js");

function chromiumAlternativo() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  if (!fs.existsSync(base)) return undefined;
  const pastas = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const p of pastas) {
    const exe = path.join(base, p, "chrome-win64", "chrome.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

async function abrirNavegador(tipo) {
  try {
    return await tipo.launch();
  } catch (e) {
    if (tipo !== chromium) return null;
    const exe = chromiumAlternativo();
    if (!exe) throw e;
    console.log(`Chromium da revisão do pacote ausente; usando ${exe}`);
    return chromium.launch({ executablePath: exe });
  }
}

// ---------- dados ----------
function lerEnv() {
  const texto = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
  const env = {};
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

async function codigoDisponivel() {
  if (process.env.CODIGO_PLACA) return process.env.CODIGO_PLACA;
  const env = lerEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.SUPABASE_SECRET_KEY;
  if (!url || !chave) throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY ausente em .env.local");
  const r = await fetch(`${url}/rest/v1/placas?select=codigo&status=eq.disponivel&limit=1`, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
  });
  if (!r.ok) throw new Error(`Supabase respondeu ${r.status} ao listar placas`);
  const linhas = await r.json();
  return linhas[0]?.codigo ?? null;
}

// ---------- perfis de viewport ----------
function perfil(largura) {
  const celular = { 375: "iPhone X", 390: "iPhone 13", 430: "iPhone 14 Pro Max" }[largura];
  if (celular && devices[celular]) {
    const { defaultBrowserType: _ignorado, ...d } = devices[celular];
    return { nome: `${largura} (${celular})`, opcoes: { ...d, viewport: { width: largura, height: d.viewport.height } } };
  }
  return { nome: String(largura), opcoes: { viewport: { width: largura, height: ALTURA } } };
}

// ---------- verificação dentro da página ----------
// Recebe a largura e devolve os achados (a) a (d).
function auditarNoNavegador(largura) {
  const vw = window.innerWidth;
  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
    if (s.position === "absolute" && s.clip === "rect(0px, 0px, 0px, 0px)") return false;
    return true;
  };
  const descrever = (el) => {
    let sel = el.tagName.toLowerCase();
    if (el.id) sel += `#${el.id}`;
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
    if (cls.length) sel += "." + cls.join(".");
    const rotulo = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || (el.textContent || "").trim();
    return { sel, texto: rotulo.replace(/\s+/g, " ").slice(0, 50) };
  };
  // Um ancestral que corta o conteúdo e está dentro da janela esconde o excesso.
  const cortadoPorAncestral = (el) => {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) {
        const r = a.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return true;
      }
    }
    return false;
  };

  const de = document.documentElement;
  const rolagem = { scrollWidth: de.scrollWidth, innerWidth: vw, indevida: de.scrollWidth > vw + 1 };

  const transbordando = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    const excesso = Math.max(r.right - vw, -r.left);
    if (excesso <= 1) continue;
    if (cortadoPorAncestral(el)) continue;
    transbordando.push({ ...descrever(el), excesso: Math.round(excesso), left: Math.round(r.left), right: Math.round(r.right) });
  }
  // Mantém só os mais externos (o filho de um elemento já listado repete o problema).
  transbordando.sort((a, b) => b.excesso - a.excesso);

  const fontes = [];
  const alvos = [];
  if (largura < 768) {
    for (const el of document.querySelectorAll("input, select, textarea")) {
      const tipo = (el.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "checkbox", "radio", "submit", "button", "file", "range", "color", "image", "reset"].includes(tipo)) continue;
      if (!visivel(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) fontes.push({ ...descrever(el), fontSize: fs });
    }
    for (const el of document.querySelectorAll('button, a, input[type=checkbox], [role=button]')) {
      if (!visivel(el)) continue;
      if (el.tagName === "A" && el.closest("p")) continue; // link dentro de parágrafo de texto
      if (el.tagName === "A" && getComputedStyle(el).display === "inline") {
        const pai = el.parentElement;
        if (pai && (pai.textContent || "").trim().length > (el.textContent || "").trim().length + 3) continue; // link no meio de frase
      }
      const r = el.getBoundingClientRect();
      let w = r.width;
      let h = r.height;
      let viaLabel = false;
      const label = el.closest("label");
      if (label) {
        const rl = label.getBoundingClientRect();
        if (rl.width > w || rl.height > h) viaLabel = true;
        w = Math.max(w, rl.width);
        h = Math.max(h, rl.height);
      }
      if (w < 44 || h < 44) alvos.push({ ...descrever(el), w: Math.round(w), h: Math.round(h), viaLabel });
    }
  }
  return { rolagem, transbordando: transbordando.slice(0, 8), totalTransbordando: transbordando.length, fontes, alvos };
}

// ---------- execução ----------
const problemas = []; // { gravidade, pagina, largura, tipo, detalhe }
const GRAV = { alta: 3, media: 2, baixa: 1 };
function registrar(gravidade, pagina, largura, tipo, detalhe) {
  problemas.push({ gravidade, pagina, largura, tipo, detalhe });
}

async function novaPagina(navegador, largura) {
  const { opcoes } = perfil(largura);
  const contexto = await navegador.newContext({ ...opcoes, locale: "pt-BR" });
  const pagina = await contexto.newPage();
  const consoleErros = [];
  const http = [];
  pagina.on("console", (m) => { if (m.type() === "error") consoleErros.push(m.text().slice(0, 200)); });
  pagina.on("pageerror", (e) => consoleErros.push(`pageerror: ${String(e.message).slice(0, 200)}`));
  pagina.on("response", (r) => { if (r.status() >= 400) http.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE_URL, "")}`); });
  return { contexto, pagina, consoleErros, http };
}

async function verificarPagina(navegador, rotulo, rota, largura, extra) {
  const { contexto, pagina, consoleErros, http } = await novaPagina(navegador, largura);
  const linha = { pagina: rotulo, largura, problemas: [] };
  try {
    const resp = await pagina.goto(BASE_URL + rota, { waitUntil: "networkidle", timeout: 60000 });
    if (!resp || resp.status() >= 400) linha.problemas.push(`HTTP ${resp?.status()} na página`);
    await pagina.waitForTimeout(600); // animações de entrada
    if (extra) await extra(pagina, linha);
    const a = await pagina.evaluate(auditarNoNavegador, largura);
    if (a.rolagem.indevida) {
      const pior = a.transbordando[0];
      const txt = `rolagem horizontal: scrollWidth ${a.rolagem.scrollWidth} > ${a.rolagem.innerWidth}${pior ? `; pior: ${pior.sel} "${pior.texto}" (+${pior.excesso}px)` : ""}`;
      linha.problemas.push(txt);
      registrar("alta", rotulo, largura, "Rolagem horizontal", txt);
    }
    if (a.transbordando.length) {
      const lista = a.transbordando.slice(0, 3).map((t) => `${t.sel} "${t.texto}" (+${t.excesso}px)`).join("; ");
      const txt = `${a.totalTransbordando} elemento(s) além da janela: ${lista}`;
      linha.problemas.push(txt);
      registrar(a.rolagem.indevida ? "alta" : "media", rotulo, largura, "Elemento além da largura", txt);
    }
    for (const f of a.fontes) {
      const txt = `campo com fonte ${f.fontSize}px (<16, iOS dá zoom ao focar): ${f.sel} "${f.texto}"`;
      linha.problemas.push(txt);
      registrar("media", rotulo, largura, "Fonte de campo < 16px", txt);
    }
    for (const t of a.alvos) {
      const txt = `alvo de toque ${t.w}x${t.h}px (<44): ${t.sel} "${t.texto}"${t.viaLabel ? " (medido com o label)" : ""}`;
      linha.problemas.push(txt);
      registrar("baixa", rotulo, largura, "Alvo de toque < 44px", txt);
    }
    for (const c of consoleErros) {
      linha.problemas.push(`console: ${c}`);
      registrar("media", rotulo, largura, "Erro no console", c);
    }
    for (const h of http) {
      linha.problemas.push(`HTTP ${h}`);
      registrar("media", rotulo, largura, "Resposta HTTP 4xx/5xx", h);
    }
    const nomeArq = `${rotulo.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${largura}.png`;
    await pagina.screenshot({ path: path.join(SAIDA, nomeArq), fullPage: true });
  } catch (e) {
    linha.problemas.push(`falha ao verificar: ${e.message.split("\n")[0]}`);
    registrar("alta", rotulo, largura, "Falha na verificação", e.message.split("\n")[0]);
  } finally {
    await contexto.close();
  }
  return linha;
}

// ---------- fluxos ----------
const fluxos = []; // { nome, ok, detalhe }
function resultadoFluxo(nome, ok, detalhe) {
  fluxos.push({ nome, ok, detalhe });
  if (!ok) registrar("alta", "fluxo", "-", nome, detalhe);
}

async function fluxoEntrar(navegador, largura) {
  const { contexto, pagina, consoleErros } = await novaPagina(navegador, largura);
  try {
    await pagina.goto(`${BASE_URL}/entrar`, { waitUntil: "networkidle" });
    const email = pagina.locator("#email");
    const senha = pagina.locator("#senha");

    // 1. Formulário vazio: o navegador deve bloquear pelo required.
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await pagina.waitForTimeout(500);
    const bloqueio = await pagina.evaluate(() => {
      const f = document.querySelector("#email").form;
      return { valido: f.checkValidity(), emailMsg: document.querySelector("#email").validationMessage, url: location.pathname };
    });
    const alertaVazio = await pagina.locator(ALERTA).filter({ hasText: /\S/ }).count();
    resultadoFluxo(`/entrar vazio bloqueado pelo navegador (${largura})`, !bloqueio.valido && bloqueio.url === "/entrar" && alertaVazio === 0,
      `checkValidity=${bloqueio.valido}, mensagem do navegador="${bloqueio.emailMsg}", alertas do servidor=${alertaVazio}`);

    // 2. Mostrar/ocultar senha.
    await senha.fill("SenhaErrada123");
    const antes = await senha.getAttribute("type");
    await pagina.getByRole("button", { name: "Mostrar senha" }).click();
    const depois = await senha.getAttribute("type");
    await pagina.getByRole("button", { name: "Ocultar senha" }).click();
    const volta = await senha.getAttribute("type");
    resultadoFluxo(`/entrar mostrar/ocultar senha (${largura})`, antes === "password" && depois === "text" && volta === "password", `type: ${antes} -> ${depois} -> ${volta}`);

    // 3. Credenciais inexistentes.
    await email.fill("naoexiste@example.com");
    await senha.fill("SenhaErrada123");
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    const alerta = pagina.locator(ALERTA).filter({ hasText: /\S/ });
    await alerta.first().waitFor({ timeout: 20000 });
    const texto = (await alerta.first().innerText()).trim();
    const a = await pagina.evaluate(auditarNoNavegador, largura);
    await pagina.screenshot({ path: path.join(SAIDA, `fluxo-entrar-erro-${largura}.png`), fullPage: true });
    const claro = /incorret|tentativas/i.test(texto);
    resultadoFluxo(`/entrar credenciais inválidas mostram erro (${largura})`, claro, `mensagem: "${texto}"`);
    resultadoFluxo(`/entrar layout com erro (${largura})`, !a.rolagem.indevida && a.transbordando.length === 0,
      `scrollWidth ${a.rolagem.scrollWidth}/${a.rolagem.innerWidth}, elementos além da janela: ${a.totalTransbordando}`);
    if (consoleErros.length) registrar("media", "/entrar (fluxo)", largura, "Erro no console", consoleErros.join(" | "));
  } catch (e) {
    resultadoFluxo(`/entrar fluxo (${largura})`, false, e.message.split("\n")[0]);
  } finally {
    await contexto.close();
  }
}

async function fluxoCadastro(navegador, largura) {
  const { contexto, pagina } = await novaPagina(navegador, largura);
  try {
    await pagina.goto(`${BASE_URL}/cadastro`, { waitUntil: "networkidle" });
    const campos = { nome: "#nome", email: "#email", telefone: "#telefone", senha: "#senha", confirmacao: "#confirmacao", termos: "input[name=termos]" };
    const faltando = [];
    for (const [n, s] of Object.entries(campos)) if (!(await pagina.locator(s).isVisible())) faltando.push(n);
    const required = await pagina.evaluate((sels) => Object.entries(sels).filter(([, s]) => !document.querySelector(s)?.required).map(([n]) => n), campos);
    resultadoFluxo(`/cadastro campos presentes (${largura})`, faltando.length === 0, faltando.length ? `faltando: ${faltando.join(", ")}` : `todos visíveis; sem required: ${required.join(", ") || "nenhum"}`);

    const requisitos = pagina.locator('ul[aria-label="Requisitos da senha"] li');
    const estado = async () => requisitos.evaluateAll((lis) => lis.map((li) => li.textContent.includes("(atendido)")));
    const vazio = await estado();
    await pagina.locator("#senha").pressSequentially("abc", { delay: 20 });
    const parcial = await estado();
    await pagina.locator("#senha").fill("");
    await pagina.locator("#senha").pressSequentially("SenhaForte#2026x", { delay: 10 });
    const completo = await estado();
    const reage = vazio.every((v) => !v) && parcial.some((v) => v) && completo.filter(Boolean).length > parcial.filter(Boolean).length;
    resultadoFluxo(`/cadastro requisitos de senha reagem (${largura})`, reage,
      `atendidos: vazio ${vazio.filter(Boolean).length}/${vazio.length}, "abc" ${parcial.filter(Boolean).length}, senha forte ${completo.filter(Boolean).length}`);

    await pagina.locator("#confirmacao").fill("Diferente1!");
    const divergencia = await pagina.getByText("As senhas não coincidem.").isVisible();
    resultadoFluxo(`/cadastro aviso de senhas diferentes (${largura})`, divergencia, divergencia ? "aviso exibido" : "aviso não apareceu");
    const a = await pagina.evaluate(auditarNoNavegador, largura);
    resultadoFluxo(`/cadastro layout com medidor e requisitos (${largura})`, !a.rolagem.indevida && a.transbordando.length === 0,
      `scrollWidth ${a.rolagem.scrollWidth}/${a.rolagem.innerWidth}, elementos além da janela: ${a.totalTransbordando}`);
    await pagina.screenshot({ path: path.join(SAIDA, `fluxo-cadastro-requisitos-${largura}.png`), fullPage: true });
  } catch (e) {
    resultadoFluxo(`/cadastro fluxo (${largura})`, false, e.message.split("\n")[0]);
  } finally {
    await contexto.close();
  }
}

async function fluxoAtivacao(navegador, largura, codigo) {
  const { contexto, pagina, consoleErros } = await novaPagina(navegador, largura);
  try {
    await pagina.goto(`${BASE_URL}/ativar/${codigo}`, { waitUntil: "networkidle" });
    const busca = pagina.getByLabel("Nome da empresa");
    await busca.fill("Padaria Piracicaba");
    await pagina.getByRole("button", { name: "Buscar" }).click(); // única chamada à API do Google
    const resultado = pagina.locator(`ul[aria-live="polite"] li, ${ALERTA}`).or(pagina.getByText("Nenhuma empresa encontrada"));
    await resultado.first().waitFor({ timeout: 30000 });
    const itens = await pagina.locator('ul[aria-live="polite"] li').count();
    const erro = (await pagina.locator(ALERTA).allInnerTexts()).join(" ").trim();
    await pagina.waitForTimeout(400);
    const a = await pagina.evaluate(auditarNoNavegador, largura);
    await pagina.screenshot({ path: path.join(SAIDA, `fluxo-ativar-busca-${largura}.png`), fullPage: true });
    resultadoFluxo(`/ativar busca retorna resultados (${largura})`, itens > 0 && !erro, `${itens} resultado(s)${erro ? `; erro: "${erro}"` : ""} (nenhum clicado)`);
    resultadoFluxo(`/ativar layout com resultados (${largura})`, !a.rolagem.indevida && a.transbordando.length === 0,
      `scrollWidth ${a.rolagem.scrollWidth}/${a.rolagem.innerWidth}; além da janela: ${a.transbordando.slice(0, 3).map((t) => `${t.sel} (+${t.excesso}px)`).join("; ") || "nenhum"}`);
    for (const t of a.alvos) registrar("baixa", "/ativar (resultados)", largura, "Alvo de toque < 44px", `${t.w}x${t.h}px: ${t.sel} "${t.texto}"`);
    if (consoleErros.length) registrar("media", "/ativar (busca)", largura, "Erro no console", consoleErros.join(" | "));
  } catch (e) {
    resultadoFluxo(`/ativar busca (${largura})`, false, e.message.split("\n")[0]);
  } finally {
    await contexto.close();
  }
}

// ---------- relatório ----------
function escapar(t) {
  return String(t).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function gerarRelatorio(linhas, info) {
  const paginas = [...new Set(linhas.map((l) => l.pagina))];
  const md = [];
  md.push("# Relatório de responsividade e fluxos públicos", "");
  md.push(`Gerado em ${new Date().toLocaleString("pt-BR")} contra ${BASE_URL}. Navegador: ${info.navegador}. Playwright ${info.versao} (${info.dir}).`);
  md.push(`Código de placa usado na ativação: ${info.codigo ?? "nenhum disponível"}. 375/390/430 emulam iPhone (isMobile, hasTouch, user agent de iPhone) no Chromium.`, "");
  md.push("## Tabela página x largura", "");
  md.push(`| Página | ${LARGURAS.join(" | ")} |`);
  md.push(`|---|${LARGURAS.map(() => "---").join("|")}|`);
  for (const p of paginas) {
    const cel = LARGURAS.map((w) => {
      const l = linhas.find((x) => x.pagina === p && x.largura === w);
      if (!l) return "-";
      return l.problemas.length ? `${l.problemas.length} problema(s)` : "ok";
    });
    md.push(`| ${p} | ${cel.join(" | ")} |`);
  }
  md.push("", "## Fluxos", "");
  md.push("| Verificação | Resultado | Detalhe |", "|---|---|---|");
  for (const f of fluxos) md.push(`| ${escapar(f.nome)} | ${f.ok ? "ok" : "FALHOU"} | ${escapar(f.detalhe)} |`);

  md.push("", "## Problemas (do mais grave para o menos grave)", "");
  if (!problemas.length) md.push("Nenhum problema encontrado.");
  // Agrupa o mesmo achado em várias larguras.
  const grupos = new Map();
  for (const p of problemas) {
    const chave = `${p.gravidade}|${p.pagina}|${p.tipo}|${p.detalhe.replace(/scrollWidth \d+ > \d+/, "").replace(/\d+x\d+px/, "")}`;
    const g = grupos.get(chave) ?? { ...p, larguras: [] };
    g.larguras.push(p.largura);
    grupos.set(chave, g);
  }
  const ordenados = [...grupos.values()].sort((a, b) => GRAV[b.gravidade] - GRAV[a.gravidade] || a.pagina.localeCompare(b.pagina));
  let n = 1;
  for (const g of ordenados) md.push(`${n++}. **[${g.gravidade}] ${g.pagina}** (larguras ${g.larguras.join(", ")}): ${g.tipo}. ${g.detalhe}`);

  md.push("", "## Detalhe por página e largura", "");
  for (const l of linhas) {
    if (!l.problemas.length) continue;
    md.push(`### ${l.pagina} @ ${l.largura}`, ...l.problemas.map((p) => `- ${p}`), "");
  }
  md.push("", "Capturas: `tests/e2e/saida/<pagina>-<largura>.png` e `fluxo-*.png`.");
  fs.writeFileSync(path.join(SAIDA, "relatorio.md"), md.join("\n"), "utf8");
}

// ---------- principal ----------
async function principal() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const versao = JSON.parse(fs.readFileSync(path.join(dirPlaywright, "package.json"), "utf8")).version;
  const codigo = await codigoDisponivel();
  if (!codigo) registrar("alta", "/ativar", "-", "Sem placa disponível", "Nenhuma placa com status disponivel no banco");

  const navegador = await abrirNavegador(chromium);
  const nav2 = await abrirNavegador(webkit).catch(() => null);
  const info = { navegador: `Chromium ${navegador.version()}${nav2 ? ` + WebKit ${nav2.version()}` : " (WebKit não instalado)"}`, versao, dir: dirPlaywright, codigo };

  const paginas = [
    ["entrar", "/entrar"],
    ["entrar-codigo", "/entrar/codigo"],
    ["cadastro", "/cadastro"],
    ["recuperar-senha", "/recuperar-senha"],
    ["termos", "/termos"],
    ["privacidade", "/privacidade"],
    ["auth-confirmar", "/auth/confirmar"],
  ];
  if (codigo) paginas.push(["ativar", `/ativar/${codigo}`]);

  const linhas = [];
  for (const [rotulo, rota] of paginas) {
    for (const w of LARGURAS) {
      const extra = rotulo === "auth-confirmar"
        ? async (pg, linha) => {
            await pg.getByText(/Link inválido|expirou/).first().waitFor({ timeout: 15000 }).catch(() => {
              linha.problemas.push("sem mensagem de link inválido");
              registrar("alta", rotulo, w, "Mensagem ausente", "/auth/confirmar sem parâmetros não mostrou erro de link inválido");
            });
          }
        : undefined;
      const l = await verificarPagina(navegador, rotulo, rota, w, extra);
      linhas.push(l);
      console.log(`${rotulo} @ ${w}: ${l.problemas.length ? `${l.problemas.length} problema(s)` : "ok"}`);
    }
  }

  await fluxoEntrar(navegador, 375);
  await fluxoEntrar(navegador, 320);
  await fluxoCadastro(navegador, 320);
  await fluxoCadastro(navegador, 390);
  if (codigo && !process.env.PULAR_BUSCA) await fluxoAtivacao(navegador, 390, codigo);
  for (const f of fluxos) console.log(`${f.ok ? "ok    " : "FALHOU"} ${f.nome}: ${f.detalhe}`);

  await navegador.close();
  if (nav2) await nav2.close();
  gerarRelatorio(linhas, info);
  console.log(`\nRelatório: ${path.join(SAIDA, "relatorio.md")}`);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
