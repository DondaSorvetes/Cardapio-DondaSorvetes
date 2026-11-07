"use client";

import { CreditCard, Smartphone, Banknote, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethod {
  name: string;
  value: number;
  percentage: number;
}

interface PremiumPaymentMethodsProps {
  title?: string;
  description?: string;
  methods?: PaymentMethod[];
}

const paymentIconMap: Record<string, "credit" | "pix" | "cash" | "debit"> = {
  "cartao_credito": "credit",
  "cartao_debito": "debit",
  "pix": "pix",
  "dinheiro": "cash",
  "credito": "credit",
  "debito": "debit",
};

const iconMap = {
  credit: CreditCard,
  pix: Smartphone,
  cash: Banknote,
  debit: Wallet,
};

const colorMap = {
  credit: {
    bg: "bg-[#FDE6EE]",
    text: "text-[#C8285F]",
    bar: "bg-gradient-to-r from-[#C8285F] to-[#E33E70]",
  },
  pix: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    bar: "bg-gradient-to-r from-emerald-400 to-emerald-500",
  },
  cash: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    bar: "bg-gradient-to-r from-amber-400 to-amber-500",
  },
  debit: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    bar: "bg-gradient-to-r from-blue-400 to-blue-500",
  },
};

const paymentNameMap: Record<string, string> = {
  "cartao_credito": "Cartão de Crédito",
  "cartao_debito": "Cartão de Débito",
  "pix": "PIX",
  "dinheiro": "Dinheiro",
  "credito": "Cartão de Crédito",
  "debito": "Cartão de Débito",
};

export function PremiumPaymentMethods({
  title = "Métodos de Pagamento",
  description = "Distribuição por forma de pagamento",
  methods = [],
}: PremiumPaymentMethodsProps) {
  const formattedMethods = methods.map((method) => {
    const iconType = paymentIconMap[method.name.toLowerCase()] || "credit";
    return {
      ...method,
      displayName: paymentNameMap[method.name.toLowerCase()] || method.name,
      icon: iconType,
    };
  });

  const total = formattedMethods.reduce((sum, method) => sum + method.value, 0);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
        <p className="text-sm text-[#6B7280] mt-1">{description}</p>
      </div>

      <div className="space-y-5">
        {formattedMethods.map((method) => {
          const Icon = iconMap[method.icon];
          const colors = colorMap[method.icon];

          return (
            <div key={method.name} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform",
                      colors.bg
                    )}
                  >
                    <Icon className={cn("w-5 h-5", colors.text)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#111827]">
                      {method.displayName}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {method.percentage}% do total
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#111827]">
                    R$ {method.value.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    colors.bar
                  )}
                  style={{ width: `${method.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#111827]">
            Total Processado
          </span>
          <span className="text-lg font-bold text-[#C8285F]">
            R$ {total.toFixed(2).replace(".", ",")}
          </span>
        </div>
      </div>
    </div>
  );
}
