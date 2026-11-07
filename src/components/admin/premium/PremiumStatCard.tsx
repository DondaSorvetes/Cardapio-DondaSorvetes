"use client";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Target,
  Zap,
  CreditCard,
  Package,
  Ticket,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  DollarSign,
  ShoppingBag,
  Users,
  Target,
  Zap,
  CreditCard,
  Package,
  Ticket,
  BarChart3,
  Settings,
  TrendingUp,
};

type IconName = keyof typeof iconMap;

interface PremiumStatCardProps {
  title: string;
  value: string | number;
  icon: IconName;
  trend?: number;
  trendLabel?: string;
  sparklineData?: number[];
  variant?: "purple" | "blue" | "green" | "orange" | "pink";
  subtitle?: string;
}

const variantStyles = {
  purple: {
    iconBg: "bg-[#FDE6EE]",
    iconColor: "text-[#C8285F]",
    sparkline: "#E33E70",
  },
  blue: {
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    sparkline: "#3B82F6",
  },
  green: {
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    sparkline: "#22C55E",
  },
  orange: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    sparkline: "#F59E0B",
  },
  pink: {
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    sparkline: "#EC4899",
  },
};

export function PremiumStatCard({
  title,
  value,
  icon: iconName,
  trend,
  trendLabel,
  sparklineData,
  variant = "purple",
  subtitle,
}: PremiumStatCardProps) {
  const styles = variantStyles[variant];
  const isPositiveTrend = trend !== undefined && trend >= 0;
  const IconComponent = iconMap[iconName];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            styles.iconBg
          )}
        >
          <IconComponent className={cn("w-6 h-6", styles.iconColor)} />
        </div>
        {trend !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg",
              isPositiveTrend
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            )}
          >
            {isPositiveTrend ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-[#6B7280]">{title}</p>
        <p className="text-3xl font-bold text-[#111827] tracking-tight">
          {value}
        </p>
        {(trendLabel || subtitle) && (
          <p className="text-xs text-[#6B7280] pt-1">
            {trendLabel || subtitle}
          </p>
        )}
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-4 h-12 flex items-end gap-1">
          {sparklineData.map((value, index) => {
            const maxValue = Math.max(...sparklineData);
            const height = (value / maxValue) * 100;
            return (
              <div
                key={index}
                className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-75"
                style={{
                  height: `${height}%`,
                  backgroundColor: styles.sparkline,
                  opacity: 0.3 + (height / 100) * 0.7,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
