import { LogoCompleta } from "@/components/marca/marca";

export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-marca-fundo px-4 text-center">
      <LogoCompleta className="h-14 sm:h-16" prioridade />
      <p className="max-w-sm text-sm text-neutral-400">
        Aproxime o celular ou leia o QR Code da sua placa para avaliar no Google.
      </p>
    </main>
  );
}
