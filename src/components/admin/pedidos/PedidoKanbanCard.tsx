"use client";

import { memo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import type { Pedido } from "@/types/pedido";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  shortOrderId,
  isDeliveryType,
  isPickupType,
  getOrderActions,
} from "./order-status";
import { ModalidadeBadge } from "./ModalidadeBadge";
import { OrderElapsedTimer } from "./OrderElapsedTimer";
import {
  getPedidoColumnId,
  paymentBadgeLabel,
  type KanbanColumnId,
} from "./kanban-columns";

interface PedidoKanbanCardProps {
  pedido: Pedido;
  isHighlighted?: boolean;
  isSelected?: boolean;
  onOpen: (pedido: Pedido) => void;
  onAction: (
    pedido: Pedido,
    action:
      | { type: "status"; status: Pedido["status"]; printAfter?: boolean }
      | { type: "print" }
      | { type: "details" }
  ) => void;
  disabled?: boolean;
  /** row = lista vertical compacta; card = bloco (legado) */
  layout?: "row" | "card";
}

const COLUMN_ACCENT: Record<KanbanColumnId, string> = {
  em_aberto: "bg-[#C8285F]",
  em_producao: "bg-blue-500",
  pronto_retirada: "bg-violet-500",
  saiu_entrega: "bg-orange-500",
  finalizados: "bg-emerald-500",
};

function PedidoKanbanCardComponent({
  pedido,
  isHighlighted,
  isSelected,
  onOpen,
  onAction,
  disabled,
  layout = "row",
}: PedidoKanbanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: pedido.id,
    data: { pedido },
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colId = getPedidoColumnId(pedido);
  const actions = getOrderActions(pedido);
  const hora = format(new Date(pedido.created_at), "HH:mm");
  const itensResumo =
    pedido.itens.length === 0
      ? "—"
      : pedido.itens.length === 1
        ? `${pedido.itens[0].qty}x ${pedido.itens[0].produto.name}`
        : `${pedido.itens.reduce((s, i) => s + (i.qty || 1), 0)} itens`;

  const menu = (
    <div
      className={cn(
        layout === "row"
          ? "shrink-0"
          : "absolute right-1 top-1/2 -translate-y-1/2 md:right-1.5 md:top-1.5 md:translate-y-0"
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 w-8 rounded-md border bg-white flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]",
              layout === "card" ? "border-transparent md:border-[#E5E7EB]" : "border-[#E5E7EB]"
            )}
            aria-label="Ações do pedido"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 text-[13px]">
          {actions.map((a) => (
            <DropdownMenuItem
              key={`${a.label}-${a.status}-${a.printAfter ? "p" : ""}`}
              className={cn(
                "text-[13px]",
                a.variant === "danger" && "text-red-600 focus:text-red-600"
              )}
              onClick={() =>
                onAction(pedido, {
                  type: "status",
                  status: a.status,
                  printAfter: a.printAfter,
                })
              }
            >
              {a.label}
            </DropdownMenuItem>
          ))}
          {actions.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            className="text-[13px]"
            onClick={() => onAction(pedido, { type: "print" })}
          >
            Imprimir
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-[13px]"
            onClick={() => onAction(pedido, { type: "details" })}
          >
            Detalhes
          </DropdownMenuItem>
          {!isDeliveryType(pedido.tipo_entrega) &&
            pedido.status === "preparando" && (
              <DropdownMenuItem
                className="text-[13px]"
                onClick={() =>
                  onAction(pedido, { type: "status", status: "entregue" })
                }
              >
                Finalizar
              </DropdownMenuItem>
            )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  /* ── Linha horizontal (layout vertical da tela) ── */
  if (layout === "row") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          "group relative flex items-center gap-2 sm:gap-3 rounded-md border bg-white",
          "min-h-[64px] pl-3 pr-2 py-2 select-none touch-manipulation",
          "hover:border-[#D1D5DB] hover:bg-[#FAFAFA]",
          isSelected
            ? "border-[#C8285F] bg-[#F8F5FC]"
            : "border-[#E5E7EB]",
          isDragging && "opacity-60 shadow-md z-20",
          isHighlighted && !isSelected && "ring-2 ring-[#C8285F]/35 border-[#C8285F]/50",
          pedido.status === "cancelado" && "opacity-80"
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md",
            COLUMN_ACCENT[colId]
          )}
        />

        <button
          type="button"
          onClick={() => onOpen(pedido)}
          className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 text-left"
        >
          {/* Nº + cliente */}
          <div className="min-w-0 w-[28%] sm:w-[22%]">
            <p className="text-[15px] font-semibold text-[#111827] leading-tight">
              #{shortOrderId(pedido.id)}
            </p>
            <p className="text-[13px] text-[#6B7280] break-words mt-0.5">
              {pedido.cliente_nome}
            </p>
          </div>

          {/* Itens */}
          <div className="min-w-0 flex-1 hidden sm:block">
            <p className="text-[13px] text-[#374151] truncate">{itensResumo}</p>
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#F3F4F6] text-[#4B5563]">
                {paymentBadgeLabel(pedido.meio_pagamento)}
              </span>
              <ModalidadeBadge tipo={pedido.tipo_entrega} agendadoPara={pedido.agendado_para} />
              {pedido.status === "pendente" && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#FDE6EE] text-[#C8285F]">
                  Novo
                </span>
              )}
              {pedido.status === "cancelado" && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700">
                  Cancelado
                </span>
              )}
            </div>
          </div>

          {/* Mobile badges */}
          <div className="flex flex-col gap-0.5 sm:hidden min-w-0 flex-1">
            <p className="text-[12px] text-[#9CA3AF] truncate">{itensResumo}</p>
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] px-1 rounded bg-[#F3F4F6] text-[#4B5563]">
                {paymentBadgeLabel(pedido.meio_pagamento)}
              </span>
              <ModalidadeBadge tipo={pedido.tipo_entrega} agendadoPara={pedido.agendado_para} />
            </div>
          </div>

          {/* Hora + valor + tempo */}
          <div className="shrink-0 text-right w-[88px] sm:w-[100px]">
            <p className="text-[11px] text-[#9CA3AF] tabular-nums">{hora}</p>
            <p className="text-[14px] font-bold text-[#111827] tabular-nums">
              {formatCurrency(pedido.total)}
            </p>
            <div className="mt-0.5 flex justify-end">
              <OrderElapsedTimer
                createdAt={pedido.created_at}
                compact
              />
            </div>
          </div>
        </button>

        {menu}
      </div>
    );
  }

  /* ── Card bloco (fallback) ── */
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative rounded-md border border-[#E5E7EB] bg-white text-left",
        "min-h-[96px] select-none touch-manipulation",
        "hover:border-[#D1D5DB]",
        isDragging && "opacity-60 shadow-md z-20",
        isHighlighted && "ring-2 ring-[#C8285F]/35 border-[#C8285F]/50",
        pedido.status === "cancelado" && "opacity-80"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md",
          COLUMN_ACCENT[colId]
        )}
      />

      {/* Celular: duas linhas — quem/quanto e o que/há quanto tempo. */}
      <button
        type="button"
        onClick={() => onOpen(pedido)}
        className="w-full py-3 pl-4 pr-12 text-left md:hidden"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[15px] leading-tight">
            <span className="font-semibold text-[#111827]">
              #{shortOrderId(pedido.id)}
            </span>{" "}
            <span className="text-[#4B5563]">{pedido.cliente_nome}</span>
          </p>
          <p className="shrink-0 text-[15px] font-bold tabular-nums text-[#111827]">
            {formatCurrency(pedido.total)}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[12.5px] text-[#8A8394]">
            {[
              itensResumo,
              isPickupType(pedido.tipo_entrega) ? "Retirada" : "Entrega",
              paymentBadgeLabel(pedido.meio_pagamento),
            ].join(" · ")}
          </p>
          <OrderElapsedTimer
            createdAt={pedido.created_at}
            compact
            className="shrink-0"
          />
        </div>
        {pedido.agendado_para && isPickupType(pedido.tipo_entrega) && (
          <ModalidadeBadge
            tipo={pedido.tipo_entrega}
            agendadoPara={pedido.agendado_para}
            className="mt-1.5"
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => onOpen(pedido)}
        className="hidden w-full p-3 text-left md:block"
      >
        <div className="flex items-start justify-between gap-1 md:pr-10">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#111827] leading-tight">
              #{shortOrderId(pedido.id)}
            </p>
            <p className="text-[13px] text-[#6B7280] break-words mt-0.5">
              {pedido.cliente_nome}
            </p>
          </div>
          <OrderElapsedTimer
            createdAt={pedido.created_at}
            compact
            className="shrink-0"
          />
        </div>
        <p className="text-[12px] text-[#9CA3AF] truncate mt-1.5">
          {itensResumo}
        </p>
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#F3F4F6] text-[#4B5563]">
              {paymentBadgeLabel(pedido.meio_pagamento)}
            </span>
            <ModalidadeBadge tipo={pedido.tipo_entrega} agendadoPara={pedido.agendado_para} />
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-[#9CA3AF] tabular-nums">{hora}</p>
            <p className="text-[14px] font-bold text-[#111827] tabular-nums">
              {formatCurrency(pedido.total)}
            </p>
          </div>
        </div>
      </button>
      {menu}
    </div>
  );
}

export const PedidoKanbanCard = memo(
  PedidoKanbanCardComponent,
  (a, b) =>
    a.isHighlighted === b.isHighlighted &&
    a.isSelected === b.isSelected &&
    a.disabled === b.disabled &&
    a.layout === b.layout &&
    a.pedido.id === b.pedido.id &&
    a.pedido.status === b.pedido.status &&
    a.pedido.total === b.pedido.total &&
    a.pedido.updated_at === b.pedido.updated_at &&
    a.pedido.cliente_nome === b.pedido.cliente_nome &&
    a.pedido.tipo_entrega === b.pedido.tipo_entrega &&
    a.pedido.agendado_para === b.pedido.agendado_para
);
