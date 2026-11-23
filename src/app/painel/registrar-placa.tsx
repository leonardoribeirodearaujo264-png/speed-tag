import { DialogoEmpresa } from "@/components/placa/dialogo-empresa";
import { FormPlacaComprada } from "./form-placa-comprada";

export function AdicionarPlacaComprada({ empresa, codigoInvalido }: { empresa: string; codigoInvalido: boolean }) {
  return (
    <DialogoEmpresa tipo="placa" botao="Adicionar placa" abertoInicial={codigoInvalido}
      descricao="Digite o código impresso na placa que você recebeu.">
      <FormPlacaComprada empresas empresa={empresa} />
      {codigoInvalido && <p role="alert" className="mt-2 text-sm text-red-700">Confira o código impresso na placa.</p>}
    </DialogoEmpresa>
  );
}
