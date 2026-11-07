"use client";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialItem {
  label: string;
  value: number;
  change?: number;
  type: "positive" | "negative" | "neutral";
}

interface PremiumFinancialSummaryProps {
  title?: string;
  data: {
    entradas: number;
    saidas: number;
    lucro: number;
    taxas: number;
    cancelados: number;
  };
}

export function PremiumFinancialSummary({
  title = "Resumo Financeiro",
  data,
}: PremiumFinancialSummaryProps) {
  const items: FinancialItem[] = [
    {
      label: "Entradas",
      value: data.entradas,
      type: "positive",
    },
    {
      label: "Saídas",
      value: data.saidas,
      type: "negative",
    },
    {
      label: "Lucro Líquido",
      value: data.lucro,
      type: "positive",
    },
    {
      label: "Taxas",
      value: data.taxas,
      type: "neutral",
    },
    {
      label: "Cancelados",
      value: data.cancelados,
      type: "negative",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition-all duration-200">
      <div className="p-6 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
            <p className="text-sm text-[#6B7280] mt-1">Período atual</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FDE6EE] flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-[#C8285F]" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {items.map((item, index) => {
          const isPositive = item.type === "positive";
          const isNegative = item.type === "negative";
          const displayValue = Math.abs(item.value);

          return (
            <div key={index} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    isPositive && "bg-emerald-50 group-hover:bg-emerald-100",
                    isNegative && "bg-red-50 group-hover:bg-red-100",
                    item.type === "neutral" && "bg-gray-50 group-hover:bg-gray-100"
                  )}
                >
                  {isPositive && (
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  )}
                  {isNegative && (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  )}
                  {item.type === "neutral" && (
                    <CreditCard className="w-4 h-4 text-gray-600" />
                  )}
                </div>
                <span className="text-sm font-medium text-[#111827]">
                  {item.label}
                </span>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isPositive && "text-emerald-600",
                    isNegative && "text-red-600",
                    item.type === "neutral" && "text-[#111827]"
                  )}
                >
                  {isNegative && "- "}
                  R$ {displayValue.toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 border-t border-[#E5E7EB] bg-[#F7F8FC]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#111827]">
            Saldo Total
          </span>
          <span className="text-lg font-bold text-[#C8285F]">
            R${" "}
            {(data.entradas - data.saidas - data.taxas)
              .toFixed(2)
              .replace(".", ",")}
          </span>
        </div>
      </div>
    </div>
  );
}
