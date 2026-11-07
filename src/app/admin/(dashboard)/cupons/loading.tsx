import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando cupons"
      className="p-4 sm:p-8 space-y-5"
    >
      <div className="flex justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-11 w-full max-w-lg" />
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
