import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  variant?: "default" | "blue" | "green" | "orange" | "purple" | "pink";
  sparklineData?: number[];
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  variant = "default",
  sparklineData,
}: StatCardProps) {
  const variants = {
    default: {
      gradient: "from-gray-500 to-gray-600",
      bg: "bg-gray-50",
      ring: "ring-gray-100",
    },
    blue: {
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      ring: "ring-blue-100",
    },
    green: {
      gradient: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50",
      ring: "ring-emerald-100",
    },
    orange: {
      gradient: "from-orange-500 to-orange-600",
      bg: "bg-orange-50",
      ring: "ring-orange-100",
    },
    purple: {
      gradient: "from-[#C8285F] to-[#6b3cb0]",
      bg: "bg-pink-50",
      ring: "ring-pink-100",
    },
    pink: {
      gradient: "from-pink-500 to-pink-600",
      bg: "bg-pink-50",
      ring: "ring-pink-100",
    },
  };

  const config = variants[variant];
  const isPositiveTrend = trend !== undefined && trend >= 0;

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-200/60 p-6 hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-300/60 transition-all duration-300">
      {/* Gradient Overlay on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        {/* Icon */}
        <div
          className={cn(
            "inline-flex p-3 rounded-xl bg-gradient-to-br shadow-sm mb-4 ring-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md",
            config.gradient,
            config.ring
          )}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">
            {value}
          </p>
        </div>

        {/* Trend Indicator */}
        {trend !== undefined && (
          <div className="flex items-center gap-2 mt-4">
            <div
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold",
                isPositiveTrend
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {isPositiveTrend ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {trend >= 0 ? "+" : ""}
                {trend}%
              </span>
            </div>
            {trendLabel && (
              <span className="text-xs text-gray-500">{trendLabel}</span>
            )}
          </div>
        )}

        {/* Mini Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4 h-12 flex items-end gap-1">
            {sparklineData.map((value, index) => {
              const maxValue = Math.max(...sparklineData);
              const height = (value / maxValue) * 100;
              return (
                <div
                  key={index}
                  className={cn(
                    "flex-1 rounded-t transition-all duration-300 group-hover:opacity-80",
                    config.bg
                  )}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
