"use client";

import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface SettingsSaveIndicatorProps {
  state: SaveState;
  className?: string;
}

export function SettingsSaveIndicator({
  state,
  className,
}: SettingsSaveIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-300",
        state === "saving" && "bg-white border-[#E5E7EB] text-[#6B7280]",
        state === "saved" &&
          "bg-emerald-50 border-emerald-200 text-emerald-700",
        state === "error" && "bg-red-50 border-red-200 text-red-700",
        state === "idle" && "bg-[#F8F9FC] border-[#E5E7EB] text-[#6B7280]",
        className
      )}
    >
      {state === "saving" ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Salvando...
        </>
      ) : state === "saved" ? (
        <>
          <Check className="w-4 h-4" />
          Alterações salvas
        </>
      ) : state === "error" ? (
        <>
          <AlertCircle className="w-4 h-4" />
          Erro ao salvar
        </>
      ) : (
        <>
          <Check className="w-4 h-4 opacity-40" />
          Tudo sincronizado
        </>
      )}
    </div>
  );
}
