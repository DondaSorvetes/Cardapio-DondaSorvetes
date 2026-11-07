"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface StatusCountersProps {
  novos: number;
  emPreparo: number;
  entrega: number;
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 rounded-xl border bg-white px-2.5 py-2 text-center",
        "border-[#E5E7EB]"
      )}
    >
      <p className={cn("text-lg font-bold tabular-nums leading-none", accent)}>
        {value}
      </p>
      <p className="text-[10px] font-medium text-[#6B7280] mt-1 truncate">
        {label}
      </p>
    </div>
  );
}

function StatusCountersComponent({
  novos,
  emPreparo,
  entrega,
}: StatusCountersProps) {
  return (
    <div className="flex gap-2">
      <Counter label="Novos" value={novos} accent="text-[#C8285F]" />
      <Counter label="Em preparo" value={emPreparo} accent="text-blue-600" />
      <Counter label="Entrega" value={entrega} accent="text-orange-600" />
    </div>
  );
}

export const StatusCounters = memo(StatusCountersComponent);
