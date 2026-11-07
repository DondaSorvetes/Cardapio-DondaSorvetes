"use client";

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface PremiumPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}

export function PremiumPageHeader({
  title,
  description,
  icon: Icon,
  action,
  breadcrumb,
}: PremiumPageHeaderProps) {
  return (
    <div className="mb-8">
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-4">
          {breadcrumb.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {item.href ? (
                <a
                  href={item.href}
                  className="hover:text-[#C8285F] transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <span className="text-[#111827] font-medium">
                  {item.label}
                </span>
              )}
              {index < breadcrumb.length - 1 && <span>/</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="w-12 h-12 rounded-xl bg-[#FDE6EE] flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-[#C8285F]" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-[#111827] tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="text-[#6B7280] mt-2 max-w-2xl">{description}</p>
            )}
          </div>
        </div>

        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
