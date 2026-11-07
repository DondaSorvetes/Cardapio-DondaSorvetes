"use client";

import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsComingSoonProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
}

export function SettingsComingSoon({
  title,
  description,
  icon: Icon = Construction,
  className,
}: SettingsComingSoonProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-10 text-center shadow-sm",
        className
      )}
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-[#9CA3AF]" />
      </div>
      <h3 className="text-base font-semibold text-[#111827]">{title}</h3>
      <p className="text-sm text-[#6B7280] mt-2 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      <span className="inline-flex mt-4 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
        Em breve
      </span>
    </div>
  );
}
