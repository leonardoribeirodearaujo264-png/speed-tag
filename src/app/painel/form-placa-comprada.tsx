import { buttonVariants } from "@/components/ui/button";

export function FormPlacaComprada({ empresas = false, empresa }: { empresas?: boolean; empresa?: string }) {
  return (
    <form action="/painel/ativar" className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
      {empresas && <input type="hidden" name="origem" value="empresas" />}
      {empresa && <input type="hidden" name="empresa" value={empresa} />}
      <label className="block min-w-0 flex-1 space-y-1 text-sm font-medium">
        <span>Código da placa comprada</span>
        <input name="codigo" required maxLength={12} placeholder="Código impresso na placa"
          className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 sm:w-52" />
      </label>
      <button type="submit" className={buttonVariants({ className: "min-h-11 px-4" })}>Ativar placa</button>
    </form>
  );
}
