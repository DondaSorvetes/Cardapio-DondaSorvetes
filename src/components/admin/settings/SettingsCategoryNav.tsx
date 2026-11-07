"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

interface SettingsCategoryNavProps {
  categories: readonly SettingsCategory[] | SettingsCategory[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  /** Layout vertical (sidebar interna) em desktop */
  orientation?: "horizontal" | "vertical";
}

export function SettingsCategoryNav({
  categories,
  activeId,
  onChange,
  className,
  orientation = "horizontal",
}: SettingsCategoryNavProps) {
  if (orientation === "vertical") {
    return (
      <nav
        className={cn(
          "flex flex-col gap-0.5 p-1.5 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm",
          className
        )}
        aria-label="Categorias de configuração"
      >
        {categories.map((cat) => {
          const Icon = cat.icon;
          const active = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(cat.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left w-full",
                active
                  ? "bg-[#FDE6EE] text-[#C8285F] shadow-sm"
                  : "text-[#6B7280] hover:bg-[#F8F9FC] hover:text-[#111827]"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  active ? "text-[#C8285F]" : "text-[#9CA3AF]"
                )}
              />
              <span className="flex-1 truncate">{cat.label}</span>
              {cat.badge && (
                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                  {cat.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div
        className="inline-flex min-w-full sm:min-w-0 gap-1 p-1 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm"
        role="tablist"
      >
        {categories.map((cat) => {
          const Icon = cat.icon;
          const active = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(cat.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap",
                active
                  ? "bg-[#FDE6EE] text-[#C8285F] shadow-sm"
                  : "text-[#6B7280] hover:bg-[#F8F9FC] hover:text-[#111827]"
              )}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
              {cat.badge && (
                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                  {cat.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
