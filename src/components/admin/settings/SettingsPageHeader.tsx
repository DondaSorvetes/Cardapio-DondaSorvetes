"use client";

import type { LucideIcon } from "lucide-react";
import { SettingsSaveIndicator, type SaveState } from "./SettingsSaveIndicator";
import { cn } from "@/lib/utils";

interface SettingsPageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  saveState?: SaveState;
  className?: string;
  /** Gradiente do ícone */
  iconClassName?: string;
}

export function SettingsPageHeader({
  title,
  description,
  icon: Icon,
  saveState,
  className,
  iconClassName,
}: SettingsPageHeaderProps) {
  return (
    <div
      className={cn(
        "bg-white border-b border-[#E5E7EB] px-6 py-5",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C8285F] to-[#E33E70] flex items-center justify-center shadow-md shadow-pink-500/20",
              iconClassName
            )}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{description}</p>
          </div>
        </div>

        {saveState !== undefined && (
          <SettingsSaveIndicator state={saveState} />
        )}
      </div>
    </div>
  );
}
