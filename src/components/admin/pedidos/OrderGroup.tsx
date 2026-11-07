"use client";

import { memo } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Pedido } from "@/types/pedido";
import { cn } from "@/lib/utils";
import { OrderCard } from "./OrderCard";
import type { StatusGroupKey } from "./order-status";

interface OrderGroupProps {
  groupKey: StatusGroupKey;
  label: string;
  pedidos: Pedido[];
  isOpen: boolean;
  onToggle: () => void;
  selectedId?: string | null;
  highlightedIds?: Set<string>;
  onSelect: (pedido: Pedido) => void;
}

const groupAccent: Partial<Record<StatusGroupKey, string>> = {
  pendente: "text-[#C8285F]",
  confirmado: "text-indigo-600",
  preparando: "text-blue-600",
  retirada: "text-pink-600",
  saiu_entrega: "text-orange-600",
  entregue: "text-emerald-600",
  cancelado: "text-red-600",
};

function OrderGroupComponent({
  groupKey,
  label,
  pedidos,
  isOpen,
  onToggle,
  selectedId,
  highlightedIds,
  onSelect,
}: OrderGroupProps) {
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-1 py-1.5 rounded-lg",
          "hover:bg-white/80 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/30"
        )}
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-wide flex items-center gap-1.5",
            groupAccent[groupKey] || "text-[#6B7280]"
          )}
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              !isOpen && "-rotate-90"
            )}
          />
          {label}
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-white border border-[#E5E7EB] text-[11px] font-bold text-[#374151] normal-case tracking-normal">
            {pedidos.length}
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1 pb-1">
              {pedidos.map((pedido) => (
                <OrderCard
                  key={pedido.id}
                  pedido={pedido}
                  isSelected={selectedId === pedido.id}
                  isHighlighted={highlightedIds?.has(pedido.id)}
                  onClick={() => onSelect(pedido)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const OrderGroup = memo(OrderGroupComponent);
