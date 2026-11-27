export const POSICOES_CODIGO = ["embaixo", "meio"] as const;
export type PosicaoCodigo = (typeof POSICOES_CODIGO)[number];

export function posicaoCodigo(valor: string | null | undefined): PosicaoCodigo {
  return valor === "meio" ? "meio" : "embaixo";
}

/** Faixa branca do código no meio do QR, em fração do lado (cobre ~4% da etiqueta; o QR usa correção H). */
export const FAIXA_MEIO = { largura: 0.36, altura: 0.12 } as const;

type Props = {
  codigo: string;
  qrDataUri: string;
  /** Lado da etiqueta quadrada em px. */
  tamanho: number;
  posicao: PosicaoCodigo;
  responsiva?: boolean;
};

/**
 * Etiqueta só com o QR e o código da placa (sem a arte). Estilos inline e posição absoluta
 * para sair igual no navegador e no ImageResponse/Satori, como a ArtePlaca.
 */
export function EtiquetaQr({ codigo, qrDataUri, tamanho, posicao, responsiva = false }: Props) {
  const medida = (fracao: number) => (responsiva ? `${fracao * 100}%` : Math.round(fracao * tamanho));
  const fonte = (fracao: number) => (responsiva ? `${fracao * 100}cqw` : Math.max(6, Math.round(fracao * tamanho)));
  const noMeio = posicao === "meio";
  const ladoQr = noMeio ? 1 : 0.84;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: responsiva ? "100%" : tamanho,
        ...(responsiva ? { aspectRatio: "1", containerType: "inline-size" } : { height: tamanho }),
        backgroundColor: "#ffffff",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, também renderizado pelo Satori */}
      <img
        src={qrDataUri}
        width={Math.round(ladoQr * tamanho)}
        height={Math.round(ladoQr * tamanho)}
        alt={`QR Code da placa ${codigo}`}
        style={{ position: "absolute", top: 0, left: medida((1 - ladoQr) / 2), width: medida(ladoQr), height: medida(ladoQr) }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#000000",
          letterSpacing: fonte(noMeio ? 0.006 : 0.012),
          ...(noMeio
            ? {
                left: medida((1 - FAIXA_MEIO.largura) / 2),
                top: medida((1 - FAIXA_MEIO.altura) / 2),
                width: medida(FAIXA_MEIO.largura),
                height: medida(FAIXA_MEIO.altura),
                backgroundColor: "#ffffff",
                fontSize: fonte(0.068),
              }
            : { left: 0, width: "100%", top: medida(0.82), height: medida(0.16), fontSize: fonte(0.105) }),
        }}
      >
        {codigo}
      </div>
    </div>
  );
}
