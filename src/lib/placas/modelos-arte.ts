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
    qr: { centroX: 764, centroY: 728, lado: 262 },
  },
  preta: {
    rotulo: "Preta",
    arquivo: "/placas/modelo-preta.jpg",
    // Quadrado do QR: x 606 a 919, y 573 a 882.
    qr: { centroX: 762, centroY: 727, lado: 262 },
  },
} as const;

export type ModeloArte = keyof typeof MODELOS_ARTE;

export const MODELO_PADRAO: ModeloArte = "azul";

export const NOMES_MODELOS = Object.keys(MODELOS_ARTE) as ModeloArte[];

export function modeloArte(valor: unknown): ModeloArte {
  return typeof valor === "string" && valor in MODELOS_ARTE ? (valor as ModeloArte) : MODELO_PADRAO;
}

/** Raio dos cantos do cartão nas imagens (unidades de 0 a 1000). */
export const RAIO_CANTO = 88;
