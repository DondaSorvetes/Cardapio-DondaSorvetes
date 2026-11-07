export function CatalogSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando catálogo"
      className="p-4 sm:p-8 space-y-5 animate-pulse motion-reduce:animate-none"
    >
      <div className="flex justify-between gap-4">
        <div className="h-8 w-32 rounded bg-gray-200" />
        <div className="h-10 w-28 rounded bg-gray-200" />
      </div>
      <div className="h-10 w-full max-w-lg rounded bg-gray-100" />
      <div className="rounded-lg border bg-white px-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b py-4 last:border-0"
          >
            <div className="h-10 w-10 shrink-0 rounded bg-gray-100" />
            <div className="h-4 w-1/2 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
