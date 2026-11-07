"use client";

import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SettingsToggleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Tooltip de ajuda em opções técnicas */
  tooltip?: string;
  className?: string;
}

export function SettingsToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  tooltip,
  className,
}: SettingsToggleCardProps) {
  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-sm",
        "transition-all duration-300 ease-out",
        "hover:shadow-md hover:border-[#F6BFD2]/60 hover:-translate-y-0.5",
        checked
          ? "border-[#F6BFD2] ring-1 ring-[#FDE6EE]"
          : "border-[#E5E7EB]",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      <div
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
          checked
            ? "bg-gradient-to-br from-[#C8285F] to-[#E33E70] text-white shadow-md shadow-pink-500/25"
            : "bg-[#F3F4F6] text-[#9CA3AF] group-hover:bg-[#FDE6EE] group-hover:text-[#C8285F]"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-[#111827] leading-snug">
            {title}
          </h3>
          {tooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                    aria-label="Ajuda"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[240px] bg-[#111827] text-white border-0"
                >
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
          {description}
        </p>
        <p
          className={cn(
            "text-[11px] font-medium mt-2 transition-colors duration-300",
            checked ? "text-emerald-600" : "text-[#9CA3AF]"
          )}
        >
          {checked ? "Ativado" : "Desativado"}
        </p>
      </div>

      <div className="shrink-0 pt-1">
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          className={cn(
            "data-[state=checked]:bg-[#C8285F] data-[state=unchecked]:bg-[#D1D5DB]",
            "h-6 w-11 transition-all duration-300",
            "[&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5",
            "[&>span]:transition-transform [&>span]:duration-300"
          )}
          aria-label={title}
        />
      </div>
    </div>
  );
}
