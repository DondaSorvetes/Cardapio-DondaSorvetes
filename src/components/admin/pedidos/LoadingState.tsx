"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState() {
  return (
    <div className="h-[calc(100vh-80px)] flex">
      {/* Lista Skeleton */}
      <div className="w-[340px] bg-[#F8F9FC] border-r border-[#E5E7EB] p-4">
        <Skeleton className="h-10 w-full mb-3" />
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>

      {/* Painel Principal Skeleton */}
      <div className="flex-1 bg-white p-6">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>

      {/* Painel Lateral Skeleton */}
      <div className="w-[280px] bg-[#F8F9FC] border-l border-[#E5E7EB] p-4">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
