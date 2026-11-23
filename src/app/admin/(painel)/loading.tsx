import { Skeleton } from "@/components/ui/skeleton";

export default function CarregandoAdmin() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Carregando">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="flex flex-col gap-2 rounded-xl border bg-white p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
