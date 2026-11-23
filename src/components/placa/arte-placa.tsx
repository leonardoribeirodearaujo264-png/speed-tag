import { MODELOS_ARTE, MODELO_PADRAO, RAIO_CANTO, type ModeloArte } from "@/lib/placas/modelos-arte";

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
};

export function ArtePlaca({ codigo, qrDataUri, tamanho, modelo = MODELO_PADRAO, fundo }: Props) {
  const u = tamanho / 1000;
  const px = (v: number) => Math.round(v * u);
  const { arquivo, qr } = MODELOS_ARTE[modelo];
  const ladoQr = px(qr.lado);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: tamanho,
        height: tamanho,
        borderRadius: px(RAIO_CANTO),
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- também renderizado pelo Satori */}
      <img src={fundo ?? arquivo} width={tamanho} height={tamanho} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, também renderizado pelo Satori */}
      <img
        src={qrDataUri}
        width={ladoQr}
        height={ladoQr}
        alt={`QR Code da placa ${codigo}`}
        style={{ position: "absolute", left: px(qr.centroX) - ladoQr / 2, top: px(qr.centroY) - ladoQr / 2 }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          justifyContent: "center",
          left: px(qr.centroX - 160),
          width: px(320),
          top: px(qr.centroY + 165),
          fontSize: Math.max(6, px(22)),
          letterSpacing: px(5),
          color: "#64748b",
        }}
      >
        {codigo}
      </div>
    </div>
  );
}
