"use client";

import { ShoppingBag } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F8F9FC] flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-[#6B7280]" />
        </div>
        <h3 className="text-lg font-semibold text-[#111827] mb-2">
          Selecione um pedido
        </h3>
        <p className="text-sm text-[#6B7280]">
          Escolha um pedido na lista ao lado para visualizar todos os detalhes
        </p>
      </div>
    </div>
  );
}
