"use client";

export function OrdersSkeleton() {
  return (
    <div role="status" aria-label="Carregando pedidos" className="h-full flex animate-pulse motion-reduce:animate-none">
      <div className="w-full md:w-[420px] max-w-full border-r border-[#E5E7EB] bg-[#F7F8FC] p-3 space-y-3">
        <div className="h-5 w-24 bg-[#E5E7EB] rounded" />
        <div className="h-10 bg-white border border-[#E5E7EB] rounded-xl" />
        <div className="h-14 bg-white border border-[#E5E7EB] rounded-xl" />
        <div className="flex gap-2">
          <div className="flex-1 h-14 bg-white border border-[#E5E7EB] rounded-xl" />
          <div className="flex-1 h-14 bg-white border border-[#E5E7EB] rounded-xl" />
          <div className="flex-1 h-14 bg-white border border-[#E5E7EB] rounded-xl" />
        </div>
        <div className="h-10 bg-[#E5E7EB] rounded-xl" />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 bg-white border border-[#E5E7EB] rounded-xl"
          />
        ))}
      </div>
      <div className="hidden md:flex flex-1 bg-white p-8 items-center justify-center">
        <div className="w-48 h-4 bg-[#E5E7EB] rounded" />
      </div>
    </div>
  );
}
