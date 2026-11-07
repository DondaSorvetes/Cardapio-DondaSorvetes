"use client";

import { Package } from "lucide-react";

export function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FDE6EE] flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-[#C8285F]" />
        </div>
        <h3 className="text-lg font-semibold text-[#111827] mb-2">
          Selecione um produto
        </h3>
        <p className="text-sm text-[#6B7280] max-w-sm">
          Escolha um produto na lista à esquerda para visualizar e editar seus
          detalhes
        </p>
      </div>
    </div>
  );
}
