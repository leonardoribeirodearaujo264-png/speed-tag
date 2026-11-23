import type { CSSProperties } from "react";

/**
 * Arte da placa (frente). Componente puro com estilos inline e só flexbox,
 * para funcionar igual no navegador (prévia e folha de impressão) e no
 * ImageResponse/Satori (PNG). Toda medida é proporcional a `tamanho`.
 */
type Props = {
  codigo: string;
  qrDataUri: string;
  /** Lado da placa quadrada em px. */
  tamanho: number;
};

const AZUL_ESCURO = "#1d4ed8";
const AZUL_CLARO = "#3b82f6";
const DOURADO = "#fbbf24";

function Estrela({ lado }: { lado: number }) {
  return (
    <svg width={lado} height={lado} viewBox="0 0 24 24" aria-hidden>
      <path
        fill={DOURADO}
        d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z"
      />
    </svg>
  );
}

function IconeAproximar({ lado }: { lado: number }) {
  return (
    <svg width={lado} height={lado} viewBox="0 0 64 64" aria-hidden>
      <rect x="20" y="8" width="26" height="46" rx="5" fill="none" stroke={AZUL_ESCURO} strokeWidth="3.5" />
      <rect x="29" y="47" width="8" height="2.5" rx="1.25" fill={AZUL_ESCURO} />
      <path d="M15 22a12 12 0 0 0 0 20" fill="none" stroke={AZUL_CLARO} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M10 16a20 20 0 0 0 0 32" fill="none" stroke={AZUL_CLARO} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function ArtePlaca({ codigo, qrDataUri, tamanho }: Props) {
  const u = tamanho / 1000;
  const px = (v: number) => Math.round(v * u);

  const raiz: CSSProperties = {
    width: tamanho,
    height: tamanho,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
    borderRadius: px(48),
    overflow: "hidden",
    fontFamily: "sans-serif",
  };

  return (
    <div style={raiz}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: px(470),
          backgroundImage: `linear-gradient(160deg, ${AZUL_ESCURO}, ${AZUL_CLARO})`,
          color: "#ffffff",
          padding: `0 ${px(60)}px`,
        }}
      >
        <div style={{ display: "flex", gap: px(14) }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Estrela key={i} lado={px(72)} />
          ))}
        </div>
        <div style={{ display: "flex", marginTop: px(30), fontSize: px(34), letterSpacing: px(3), opacity: 0.9 }}>
          SUA OPINIÃO É MUITO IMPORTANTE
        </div>
        <div
          style={{
            display: "flex",
            marginTop: px(10),
            fontSize: px(84),
            fontWeight: 700,
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          AVALIE NO GOOGLE
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${px(40)}px ${px(70)}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: px(380) }}>
          <IconeAproximar lado={px(200)} />
          <div
            style={{
              display: "flex",
              marginTop: px(18),
              fontSize: px(34),
              fontWeight: 700,
              color: AZUL_ESCURO,
              textAlign: "center",
            }}
          >
            APROXIME O CELULAR
          </div>
          <div style={{ display: "flex", marginTop: px(6), fontSize: px(28), color: "#475569" }}>
            ou leia o QR Code
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI, também renderizado pelo Satori */}
          <img src={qrDataUri} width={px(380)} height={px(380)} alt={`QR Code da placa ${codigo}`} />
          <div
            style={{
              display: "flex",
              marginTop: px(4),
              fontSize: px(26),
              letterSpacing: px(6),
              color: "#64748b",
              fontFamily: "monospace",
            }}
          >
            {codigo}
          </div>
        </div>
      </div>
    </div>
  );
}
