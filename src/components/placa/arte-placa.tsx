import { MODELOS_ARTE, MODELO_PADRAO, type ModeloArte } from "@/lib/placas/modelos-arte";

/**
 * Arte da placa (frente): a arte do cliente como fundo e o QR Code da placa no quadrado
 * reservado. Só estilos inline, posição absoluta e flexbox, para sair igual no navegador
 * (prévia e folha de impressão) e no ImageResponse/Satori (PNG de 2000 px).
 */
type Props = {
  codigo: string;
  qrDataUri: string;
  /** Lado da placa quadrada em px. */
  tamanho: number;
  modelo?: ModeloArte;
  /** Fundo já carregado (data URI) para o Satori; no navegador usa o arquivo público. */
  fundo?: string;
  responsiva?: boolean;
};

export function ArtePlaca({ codigo, qrDataUri, tamanho, modelo = MODELO_PADRAO, fundo, responsiva = false }: Props) {
  const u = tamanho / 1000;
  const px = (v: number) => Math.round(v * u);
  const { arquivo, qr, cantos } = MODELOS_ARTE[modelo];
  const ladoQr = px(qr.lado);
  const medida = (valor: number) => responsiva ? `${valor / tamanho * 100}%` : valor;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: medida(tamanho),
        ...(responsiva ? { aspectRatio: "1", containerType: "inline-size" } : { height: tamanho }),
        // Raio por canto: o recorte fica dentro da cor da arte (sem fio branco na curva).
        borderTopLeftRadius: px(cantos.supEsq),
        borderTopRightRadius: px(cantos.supDir),
        borderBottomRightRadius: px(cantos.infDir),
        borderBottomLeftRadius: px(cantos.infEsq),
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- também renderizado pelo Satori */}
      <img src={fundo ?? arquivo} width={tamanho} height={tamanho} alt="" style={{ position: "absolute", top: 0, left: 0, ...(responsiva && { width: "100%", height: "100%" }) }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, também renderizado pelo Satori */}
      <img
        src={qrDataUri}
        width={ladoQr}
        height={ladoQr}
        alt={`QR Code da placa ${codigo}`}
        style={{
          position: "absolute",
          left: medida(px(qr.centroX) - ladoQr / 2),
          top: medida(px(qr.centroY) - ladoQr / 2),
          ...(responsiva && { width: medida(ladoQr), height: medida(ladoQr) }),
        }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          justifyContent: "center",
          left: medida(px(qr.centroX - 160)),
          width: medida(px(320)),
          top: medida(px(qr.centroY + 165)),
          fontSize: responsiva ? "max(6px, 2.2cqw)" : Math.max(6, px(22)),
          letterSpacing: responsiva ? "0.5cqw" : px(5),
          color: "#64748b",
        }}
      >
        {codigo}
      </div>
    </div>
  );
}
