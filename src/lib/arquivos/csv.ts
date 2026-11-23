/**
 * CSV com ponto e vírgula e BOM: abre certo no Excel em português.
 * Campos que começam com = + - @ recebem aspa simples (evita injeção de fórmula).
 */
function celula(valor: string | number | null | undefined): string {
  let texto = valor == null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  if (/[";\n\r]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function gerarCsv(cabecalho: string[], linhas: Array<Array<string | number | null>>): string {
  const corpo = [cabecalho, ...linhas].map((linha) => linha.map(celula).join(";")).join("\r\n");
  return `﻿${corpo}\r\n`;
}
