/**
 * Modelos de arte da placa, feitos a partir da arte enviada pelo cliente. Cada imagem
 * tem 2000 x 2000 px (public/placas) e um quadrado vazio onde entra o QR Code.
 * Posições em unidades de 0 a 1000, medidas na própria imagem
 * (scripts/preparar-arte-cliente.py recorta e amplia).
 */
export const MODELOS_ARTE = {
  azul: {
    rotulo: "Azul",
    arquivo: "/placas/modelo-azul.jpg",
    // Quadrado do QR: x 608 a 919, y 576 a 881.
    qr: { centroX: 764, centroY: 728, lado: 318 },
    // Arte com cantos de 92/90 (em cima) e 84/85 (embaixo), medidos na imagem.
    cantos: { supEsq: 98, supDir: 97, infDir: 91, infEsq: 90 },
  },
  preta: {
    rotulo: "Preta",
    arquivo: "/placas/modelo-preta.jpg",
    // Quadrado do QR: x 606 a 919, y 573 a 882.
    qr: { centroX: 762, centroY: 727, lado: 318 },
    // Arte com cantos de 87/86 (em cima) e 83/81 (embaixo), medidos na imagem.
    cantos: { supEsq: 93, supDir: 93, infDir: 87, infEsq: 89 },
  },
} as const;

export type ModeloArte = keyof typeof MODELOS_ARTE;

export const MODELO_PADRAO: ModeloArte = "azul";

export const NOMES_MODELOS = Object.keys(MODELOS_ARTE) as ModeloArte[];

export function modeloArte(valor: unknown): ModeloArte {
  return typeof valor === "string" && valor in MODELOS_ARTE ? (valor as ModeloArte) : MODELO_PADRAO;
}

/**
 * Raio do recorte de cada canto (unidades de 0 a 1000). A arte do cliente já vem com os
 * cantos arredondados e branco do lado de fora, e cada canto tem um raio diferente. O
 * recorte usa ~6 unidades a mais que o canto medido, para cair sempre dentro da cor:
 * se ficasse menor, sobrava um fio branco na curva, que aparece na impressão.
 */
export type CantosArte = { supEsq: number; supDir: number; infDir: number; infEsq: number };
