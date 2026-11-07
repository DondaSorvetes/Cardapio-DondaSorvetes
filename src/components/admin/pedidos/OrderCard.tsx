"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { Pedido } from "@/types/pedido";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  STATUS_META,
  shortOrderId,
  tipoEntregaLabel,
} from "./order-status";
import { OrderElapsedTimer } from "./OrderElapsedTimer";

interface OrderCardProps {
  pedido: Pedido;
  isSelected: boolean;
  isHighlighted?: boolean;
  onClick: () => void;
}

function OrderCardComponent({
  pedido,
  isSelected,
  isHighlighted = false,
  onClick,
}: OrderCardProps) {
  const meta = STATUS_META[pedido.status] ?? STATUS_META.pendente;
  const isNew = pedido.status === "pendente";

  return (
    <motion.button
      type="button"
      layout
      initial={isHighlighted ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border bg-white px-3 py-2.5 relative",
        "transition-all duration-150 hover:border-[#C4B5E0]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/30",
        isSelected
          ? "border-[#C8285F] bg-[#FFF9FA] shadow-sm"
          : "border-[#E5E7EB]",
        isNew && !isSelected && "border-[#C8285F]/50"
      )}
    >
      {isSelected && (
        <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-r-full bg-[#C8285F]" />
      )}

      {isNew && (
        <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C8285F] opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C8285F]" />
        </span>
      )}

      <div className="flex items-center justify-between gap-2 pr-3">
        <span className="text-[13px] font-bold text-[#111827]">
          #{shortOrderId(pedido.id)}
        </span>
        <OrderElapsedTimer createdAt={pedido.created_at} compact />
      </div>

      <p className="text-[13px] text-[#374151] truncate mt-0.5 font-medium">
        {pedido.cliente_nome}
      </p>

      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="text-[11px] text-[#9CA3AF] truncate">
          {tipoEntregaLabel(pedido.tipo_entrega)}
          <span className="mx-1">·</span>
          <span className={cn("font-medium", meta.color)}>{meta.label}</span>
        </span>
        <span className="text-[13px] font-bold text-[#111827] tabular-nums shrink-0">
          {formatCurrency(pedido.total)}
        </span>
      </div>
    </motion.button>
  );
}

export const OrderCard = memo(
  OrderCardComponent,
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.isHighlighted === next.isHighlighted &&
    prev.pedido.id === next.pedido.id &&
    prev.pedido.status === next.pedido.status &&
    prev.pedido.total === next.pedido.total &&
    prev.pedido.updated_at === next.pedido.updated_at &&
    prev.pedido.cliente_nome === next.pedido.cliente_nome
);
