"use client";

import { cn } from "@/lib/utils";
import type { CatalogProduto } from "./types";
import { produtoStatus } from "./types";

const STYLES = {
  ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inativo: "bg-gray-100 text-gray-600 border-gray-200",
  esgotado: "bg-red-50 text-red-700 border-red-200",
  promocao: "bg-[#FDF0F4] text-[#C8285F] border-[#F6BFD2]",
} as const;

const LABELS = {
  ativo: "Ativo",
  inativo: "Inativo",
  esgotado: "Esgotado",
  promocao: "Promoção",
} as const;

export function ProdutoStatusBadge({
  produto,
  className,
}: {
  produto: CatalogProduto;
  className?: string;
}) {
  const status = produtoStatus(produto);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border uppercase tracking-wide",
        STYLES[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  );
}
