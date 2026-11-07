"use client";

import { memo } from "react";
import { Pedido, statusConfig } from "@/types/pedido";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bike, Store, CreditCard, Banknote, Smartphone } from "lucide-react";

interface OrderListItemProps {
  pedido: Pedido;
  isSelected: boolean;
  isNew?: boolean;
  onClick: () => void;
}

const paymentIcons = {
  pix: Smartphone,
  "cartão de crédito": CreditCard,
  "cartão de débito": CreditCard,
  dinheiro: Banknote,
  default: CreditCard,
};

function OrderListItemComponent({
  pedido,
  isSelected,
  isNew = false,
  onClick,
}: OrderListItemProps) {
  const statusInfo = statusConfig[pedido.status];
  const PaymentIcon =
    paymentIcons[
      pedido.meio_pagamento?.toLowerCase() as keyof typeof paymentIcons
    ] || paymentIcons.default;

  const isDelivery =
    pedido.tipo_entrega === "delivery" || pedido.tipo_entrega === "entrega";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border relative group",
        "transition-all duration-300",
        isSelected
          ? "bg-[#FDE6EE] border-[#C8285F] shadow-sm"
          : "bg-white border-[#E5E7EB] hover:border-[#C8285F] hover:shadow-sm",
        isNew &&
          !isSelected &&
          "border-emerald-300 bg-emerald-50/60 shadow-md shadow-emerald-100 ring-2 ring-emerald-200/60 animate-in fade-in slide-in-from-top-2 duration-300"
      )}
    >
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-[#C8285F] rounded-r-full" />
      )}

      {isNew && (
        <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Novo
        </span>
      )}

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#111827] truncate text-sm">
              {pedido.cliente_nome}
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              #{pedido.id.slice(0, 8)}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border flex-shrink-0",
              statusInfo.color
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", statusInfo.dot)} />
            {statusInfo.label}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#6B7280]">
          <div className="flex items-center gap-1.5">
            {isDelivery ? (
              <Bike className="w-3.5 h-3.5" />
            ) : (
              <Store className="w-3.5 h-3.5" />
            )}
            <span>{isDelivery ? "Entrega" : "Retirada"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <PaymentIcon className="w-3.5 h-3.5" />
            <span className="capitalize">{pedido.meio_pagamento}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
          <span className="text-xs text-[#6B7280]">
            {format(new Date(pedido.created_at), "HH:mm", { locale: ptBR })}
          </span>
          <span className="text-sm font-bold text-[#111827]">
            R$ {Number(pedido.total).toFixed(2).replace(".", ",")}
          </span>
        </div>
      </div>
    </button>
  );
}

export const OrderListItem = memo(
  OrderListItemComponent,
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.isNew === next.isNew &&
    prev.pedido.id === next.pedido.id &&
    prev.pedido.status === next.pedido.status &&
    prev.pedido.total === next.pedido.total &&
    prev.pedido.updated_at === next.pedido.updated_at &&
    prev.pedido.meio_pagamento === next.pedido.meio_pagamento &&
    prev.pedido.cliente_nome === next.pedido.cliente_nome
);
