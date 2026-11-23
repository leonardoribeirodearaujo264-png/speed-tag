/**
 * Gerador de ZIP mínimo (método STORE, sem compressão). Suficiente para
 * empacotar SVGs de QR para a gráfica sem adicionar dependência.
 * Formato: PKWARE APPNOTE, seções 4.3.7 (local header), 4.3.12 (central) e 4.3.16 (fim).
 */
export type ArquivoZip = { nome: string; conteudo: Uint8Array | string };

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

export function crc32(dados: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of dados) crc = TABELA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const codificador = new TextEncoder();

export function criarZip(arquivos: ArquivoZip[]): Uint8Array {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;

  for (const arquivo of arquivos) {
    const nome = codificador.encode(arquivo.nome);
    const dados =
      typeof arquivo.conteudo === "string" ? codificador.encode(arquivo.conteudo) : arquivo.conteudo;
    const crc = crc32(dados);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versão necessária
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true); // STORE
    local.setUint16(10, 0, true); // hora
    local.setUint16(12, 0x21, true); // data 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);

    const cabecalho = new DataView(new ArrayBuffer(46));
    cabecalho.setUint32(0, 0x02014b50, true);
    cabecalho.setUint16(4, 20, true);
    cabecalho.setUint16(6, 20, true);
    cabecalho.setUint16(8, 0x0800, true);
    cabecalho.setUint16(10, 0, true);
    cabecalho.setUint16(12, 0, true);
    cabecalho.setUint16(14, 0x21, true);
    cabecalho.setUint32(16, crc, true);
    cabecalho.setUint32(20, dados.length, true);
    cabecalho.setUint32(24, dados.length, true);
    cabecalho.setUint16(28, nome.length, true);
    cabecalho.setUint32(42, deslocamento, true);

    partes.push(new Uint8Array(local.buffer), nome, dados);
    central.push(new Uint8Array(cabecalho.buffer), nome);
    deslocamento += 30 + nome.length + dados.length;
  }

  const tamanhoCentral = central.reduce((soma, p) => soma + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, deslocamento, true);

  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const saida = new Uint8Array(todas.reduce((soma, p) => soma + p.length, 0));
  let pos = 0;
  for (const parte of todas) {
    saida.set(parte, pos);
    pos += parte.length;
  }
  return saida;
}
