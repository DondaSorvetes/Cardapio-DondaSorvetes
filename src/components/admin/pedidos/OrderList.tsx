"use client";

import { Pedido } from "@/types/pedido";
import { OrderListItem } from "./OrderListItem";
import { Search, Filter, Radio, WifiOff } from "lucide-react";
import { useState, useMemo, memo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RealtimeConnectionStatus } from "@/hooks/usePedidosRealtime";

interface OrderListProps {
  pedidos: Pedido[];
  selectedId?: string;
  onSelect: (pedido: Pedido) => void;
  realtimeStatus?: RealtimeConnectionStatus;
  highlightedIds?: Set<string>;
}

const statusFilters: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Recebidos" },
  { value: "preparando", label: "Preparando" },
  { value: "saiu_entrega", label: "Saiu para Entrega" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

function OrderListComponent({
  pedidos,
  selectedId,
  onSelect,
  realtimeStatus = "connecting",
  highlightedIds,
}: OrderListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  // Filtros locais — não disparam refetch; Realtime continua atualizando o state
  const filteredPedidos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pedidos.filter((pedido) => {
      const matchesSearch =
        !q ||
        pedido.cliente_nome.toLowerCase().includes(q) ||
        pedido.id.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "todos" || pedido.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [pedidos, searchQuery, statusFilter]);

  const liveLabel =
    realtimeStatus === "live"
      ? "Ao vivo"
      : realtimeStatus === "error"
        ? "Offline"
        : "Conectando";

  return (
    <div className="w-[340px] h-full bg-[#F8F9FC] border-r border-[#E5E7EB] flex flex-col">
      <div className="p-4 border-b border-[#E5E7EB] bg-white">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Pedidos</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Atualização em tempo real
            </p>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
              realtimeStatus === "live" &&
                "bg-emerald-50 text-emerald-700 border-emerald-200",
              realtimeStatus === "connecting" &&
                "bg-blue-50 text-blue-700 border-blue-200",
              realtimeStatus === "error" &&
                "bg-red-50 text-red-700 border-red-200"
            )}
            title="Supabase Realtime · postgres_changes em pedidos"
          >
            {realtimeStatus === "live" ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            ) : realtimeStatus === "error" ? (
              <WifiOff className="w-3 h-3" />
            ) : (
              <Radio className="w-3 h-3 animate-pulse" />
            )}
            {liveLabel}
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Buscar pedido ou cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-3 bg-[#F8F9FC] border border-[#E5E7EB] rounded-lg text-sm text-[#111827] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#C8285F] focus:border-transparent transition-all"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full h-10 bg-[#F8F9FC] border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#6B7280]" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredPedidos.length > 0 ? (
            filteredPedidos.map((pedido) => (
              <OrderListItem
                key={pedido.id}
                pedido={pedido}
                isSelected={selectedId === pedido.id}
                isNew={highlightedIds?.has(pedido.id) ?? false}
                onClick={() => onSelect(pedido)}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-[#6B7280]">Nenhum pedido encontrado</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-[#E5E7EB] bg-white">
        <p className="text-xs text-[#6B7280]">
          {filteredPedidos.length} de {pedidos.length} pedidos
        </p>
      </div>
    </div>
  );
}

export const OrderList = memo(OrderListComponent);
