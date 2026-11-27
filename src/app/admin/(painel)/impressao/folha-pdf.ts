import { CARREGAR_JUNTAS, baixarImagemPlaca } from "./carregar-imagem";

const MM_POR_POLEGADA = 25.4;
const PONTOS_POR_MM = 72 / MM_POR_POLEGADA;

/** 12 px/mm ≈ 305 dpi, resolução de gráfica. A folha A4 fica com 2520 x 3564 px. */
const PIXELS_POR_MM = 12;
const LARGURA = 210;
const ALTURA = 297;
const MARGEM = 10;
const FOLGA = 5;
const encoder = new TextEncoder();

/** Página já codificada: Flate (sem perda) ou JPEG, só se o navegador não comprimir. */
type PaginaPdf = { dados: Uint8Array; filtro: "FlateDecode" | "DCTDecode" };

function montarPdf(paginas: PaginaPdf[], largura: number, altura: number) {
  const blocos: ArrayBuffer[] = [];
  const offsets = [0];
  let posicao = 0;
  function escrever(valor: string | Uint8Array) {
    const bytes = typeof valor === "string" ? encoder.encode(valor) : valor;
    blocos.push(new Uint8Array(bytes).buffer);
    posicao += bytes.byteLength;
  }
  function objeto(id: number, corpo: string, conteudo?: Uint8Array) {
    offsets[id] = posicao;
    escrever(`${id} 0 obj\n${corpo}\n`);
    if (conteudo) {
      escrever("stream\n");
      escrever(conteudo);
      escrever("\nendstream\n");
    }
    escrever("endobj\n");
  }
  escrever("%PDF-1.4\n");
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const refs = paginas.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  objeto(2, `<< /Type /Pages /Kids [${refs}] /Count ${paginas.length} >>`);
  const w = (LARGURA * PONTOS_POR_MM).toFixed(4);
  const h = (ALTURA * PONTOS_POR_MM).toFixed(4);
  paginas.forEach(({ dados, filtro }, i) => {
    const id = 3 + i * 3;
    const desenho = encoder.encode(`q ${w} 0 0 ${h} 0 0 cm /Arte Do Q`);
    objeto(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Arte ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    objeto(id + 1, `<< /Type /XObject /Subtype /Image /Width ${largura} /Height ${altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${filtro} /Length ${dados.byteLength} >>`, dados);
    objeto(id + 2, `<< /Length ${desenho.byteLength} >>`, desenho);
  });
  const xref = posicao;
  escrever(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) escrever(`${String(offset).padStart(10, "0")} 00000 n \n`);
  escrever(`trailer\n<< /Root 1 0 R /Size ${offsets.length} >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(blocos, { type: "application/pdf" });
}

async function carregarArte(url: string, ladoPx: number): Promise<ImageBitmap> {
  return createImageBitmap(await baixarImagemPlaca(url, ladoPx));
}

/** RGB cru da página comprimido em zlib (FlateDecode do PDF): sem a perda do JPEG. */
async function paginaSemPerda(ctx: CanvasRenderingContext2D, largura: number, altura: number): Promise<PaginaPdf> {
  const rgba = ctx.getImageData(0, 0, largura, altura).data;
  const rgb = new Uint8Array(largura * altura * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  const fluxo = new Blob([rgb]).stream().pipeThrough(new CompressionStream("deflate"));
  return { dados: new Uint8Array(await new Response(fluxo).arrayBuffer()), filtro: "FlateDecode" };
}

async function paginaJpeg(canvas: HTMLCanvasElement): Promise<PaginaPdf> {
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha ao gerar página do PDF.")), "image/jpeg", 0.95);
  });
  return { dados: new Uint8Array(await jpeg.arrayBuffer()), filtro: "DCTDecode" };
}

/**
 * Monta a folha A4 em PDF no navegador: placas no tamanho real, várias por página, com guia
 * de corte. As imagens vêm do servidor no tamanho certo (não 2000 px), 4 de cada vez, para
 * caber na memória do celular com lotes grandes. Páginas sem perda (Flate) a ~305 dpi. `aoProgredir` recebe quantas já foram.
 */
export async function gerarFolhaPdf(urls: readonly string[], ladoCm: number, aoProgredir?: (feitas: number, total: number) => void) {
  if (!urls.length) throw new Error("A folha está vazia.");
  const ladoMm = ladoCm * 10;
  const colunas = Math.floor((LARGURA - 2 * MARGEM + FOLGA) / (ladoMm + FOLGA));
  const linhas = Math.floor((ALTURA - 2 * MARGEM + FOLGA) / (ladoMm + FOLGA));
  const porPagina = colunas * linhas;
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA * PIXELS_POR_MM;
  canvas.height = ALTURA * PIXELS_POR_MM;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx || porPagina < 1) throw new Error("Não foi possível preparar a folha.");
  const paginas: PaginaPdf[] = [];
  const semPerda = typeof CompressionStream === "function";
  const lado = ladoMm * PIXELS_POR_MM;
  let feitas = 0;
  aoProgredir?.(0, urls.length);

  for (let inicio = 0; inicio < urls.length; inicio += porPagina) {
    const folha = urls.slice(inicio, inicio + porPagina);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let lote = 0; lote < folha.length; lote += CARREGAR_JUNTAS) {
      const grupo = folha.slice(lote, lote + CARREGAR_JUNTAS);
      const imagens = await Promise.all(grupo.map((url) => carregarArte(url, lado)));
      imagens.forEach((img, j) => {
        const i = lote + j;
        const x = (MARGEM + (i % colunas) * (ladoMm + FOLGA)) * PIXELS_POR_MM;
        const y = (MARGEM + Math.floor(i / colunas) * (ladoMm + FOLGA)) * PIXELS_POR_MM;
        ctx.drawImage(img, x, y, lado, lado);
        img.close();
        ctx.strokeStyle = "#a0aab8";
        ctx.lineWidth = 2;
        ctx.setLineDash([9, 6]);
        ctx.strokeRect(x - 3, y - 3, lado + 6, lado + 6);
      });
      feitas += grupo.length;
      aoProgredir?.(feitas, urls.length);
    }
    paginas.push(semPerda ? await paginaSemPerda(ctx, canvas.width, canvas.height) : await paginaJpeg(canvas));
  }

  const pdf = montarPdf(paginas, canvas.width, canvas.height);
  canvas.width = canvas.height = 1;
  return pdf;
}
