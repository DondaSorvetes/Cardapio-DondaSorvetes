"use client";

import { memo } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

interface AutoAcceptSwitchProps {
  checked: boolean;
  loading?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function AutoAcceptSwitchComponent({
  checked,
  loading = false,
  onCheckedChange,
}: AutoAcceptSwitchProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
        "transition-colors duration-200",
        checked
          ? "bg-[#FDF0F4] border-[#F6BFD2]"
          : "bg-white border-[#E5E7EB]"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            checked ? "bg-[#C8285F] text-white" : "bg-[#F3F4F6] text-[#9CA3AF]"
          )}
        >
          <Zap className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#111827] leading-tight">
            Aceitar pedidos automaticamente
          </p>
          <p className="text-[10px] text-[#6B7280] mt-0.5">
            {checked
              ? "Novos já nascem em preparo"
              : "Novos ficam em Novos até aceitar"}
          </p>
        </div>
      </div>

      <Switch
        checked={checked}
        disabled={loading}
        onCheckedChange={onCheckedChange}
        className={cn(
          "data-[state=checked]:bg-[#C8285F] data-[state=unchecked]:bg-[#D1D5DB]",
          "h-6 w-11",
          "[&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5"
        )}
        aria-label="Aceitar pedidos automaticamente"
      />
    </div>
  );
}

export const AutoAcceptSwitch = memo(AutoAcceptSwitchComponent);
