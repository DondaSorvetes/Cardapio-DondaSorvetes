"use client";

import { useEffect, useState, memo } from "react";
import { cn } from "@/lib/utils";
import {
  elapsedMinutes,
  formatElapsed,
  elapsedTone,
} from "./order-status";

interface OrderElapsedTimerProps {
  createdAt: string;
  className?: string;
  compact?: boolean;
}

function OrderElapsedTimerComponent({
  createdAt,
  className,
  compact = false,
}: OrderElapsedTimerProps) {
  const [mins, setMins] = useState(() => elapsedMinutes(createdAt));

  useEffect(() => {
    setMins(elapsedMinutes(createdAt));
    const id = window.setInterval(() => {
      setMins(elapsedMinutes(createdAt));
    }, 15000);
    return () => window.clearInterval(id);
  }, [createdAt]);

  const tone = elapsedTone(mins);

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold tabular-nums",
        compact ? "text-[11px] px-1.5 py-0.5 rounded-md" : "text-xs px-2 py-1 rounded-lg",
        tone === "ok" && "bg-slate-100 text-slate-600",
        tone === "warn" && "bg-amber-100 text-amber-800",
        tone === "danger" && "bg-red-100 text-red-700",
        className
      )}
      title={`Entrou há ${formatElapsed(mins)}`}
    >
      {formatElapsed(mins)}
    </span>
  );
}

export const OrderElapsedTimer = memo(OrderElapsedTimerComponent);
