"use client";

import { ShoppingBag } from "lucide-react";

export function OrdersEmptyDetail() {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-[#FAFAFA] min-w-0 border-l border-[#E5E7EB]">
      <div className="text-center max-w-xs px-6">
        <div className="w-12 h-12 mx-auto mb-3 rounded-md bg-white border border-[#E5E7EB] flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-[#9CA3AF]" />
        </div>
        <h3 className="text-[15px] font-semibold text-[#111827] mb-1">
          Selecione um pedido
        </h3>
        <p className="text-[13px] text-[#6B7280] leading-relaxed">
          Clique em um pedido na lista para ver detalhes e ações.
        </p>
        <p className="mt-3 text-[11px] text-[#9CA3AF]">
          Enter aceita · Esc fecha
        </p>
      </div>
    </div>
  );
}
