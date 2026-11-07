"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  /** Espaçamento entre cards filhos */
  dense?: boolean;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  dense = false,
}: SettingsSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3 px-0.5">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-[#FDE6EE] flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-[#C8285F]" />
          </div>
        )}
        <div>
          <h2 className="text-base font-semibold text-[#111827] tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-[#6B7280] mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className={cn(dense ? "space-y-3" : "space-y-3.5")}>{children}</div>
    </section>
  );
}
