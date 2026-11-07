"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Search, RefreshCw, Volume2, VolumeX } from "lucide-react";
import type { Pedido } from "@/types/pedido";
import type { RealtimeConnectionStatus } from "@/hooks/usePedidosRealtime";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { OrderGroup } from "./OrderGroup";
import {
  type OrdersTab,
  type StatusGroupKey,
  isAgoraStatus,
  isConcluidoStatus,
  groupAgoraOrders,
  groupConcluidosOrders,
  countByStatus,
} from "./order-status";

const OPEN_GROUPS_KEY = "donda-orders-open-groups";
const SOUND_KEY = "donda-orders-sound";

interface OrdersPanelProps {
  pedidos: Pedido[];
  selectedId?: string | null;
  onSelect: (pedido: Pedido) => void;
  realtimeStatus?: RealtimeConnectionStatus;
  highlightedIds?: Set<string>;
  autoAccept: boolean;
  autoAcceptLoading?: boolean;
  onAutoAcceptChange: (value: boolean) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  soundEnabled: boolean;
  onSoundChange: (value: boolean) => void;
}

function loadOpenGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    // ignore
  }
  return {};
}

export function OrdersPanel({
  pedidos,
  selectedId,
  onSelect,
  highlightedIds,
  autoAccept,
  autoAcceptLoading,
  onAutoAcceptChange,
  onRefresh,
  refreshing = false,
  soundEnabled,
  onSoundChange,
}: OrdersPanelProps) {
  const [tab, setTab] = useState<OrdersTab>("agora");
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups(loadOpenGroups());
  }, []);

  const toggleGroup = useCallback((key: StatusGroupKey) => {
    setOpenGroups((prev) => {
      const currentlyOpen = prev[key] !== false;
      const next = { ...prev, [key]: !currentlyOpen };
      try {
        localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isGroupOpen = (key: StatusGroupKey) => openGroups[key] !== false;

  const agoraPedidos = useMemo(
    () => pedidos.filter((p) => isAgoraStatus(p.status)),
    [pedidos]
  );

  const concluidosPedidos = useMemo(
    () =>
      pedidos
        .filter((p) => isConcluidoStatus(p.status))
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
        ),
    [pedidos]
  );

  const baseList = tab === "agora" ? agoraPedidos : concluidosPedidos;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.cliente_nome.toLowerCase().includes(q) ||
        (p.cliente_telefone || "")
          .replace(/\D/g, "")
          .includes(q.replace(/\D/g, "")) ||
        (p.cliente_telefone || "").toLowerCase().includes(q)
    );
  }, [baseList, search]);

  const groups =
    tab === "agora"
      ? groupAgoraOrders(filtered)
      : groupConcluidosOrders(filtered);

  const counters = countByStatus(agoraPedidos);

  return (
    <aside className="w-full lg:w-[400px] xl:w-[420px] shrink-0 h-full bg-[#F7F8FC] border-r border-[#E5E7EB] flex flex-col">
      <div className="px-3 pt-3 pb-2 space-y-2.5 border-b border-[#E5E7EB] bg-white">
        {/* Título + som + atualizar */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#111827]">Pedidos</h2>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onSoundChange(!soundEnabled)}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                soundEnabled
                  ? "text-[#C8285F] hover:bg-[#FDF0F4]"
                  : "text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
              )}
              title={
                soundEnabled
                  ? "Som de novos pedidos ativado — clique para silenciar"
                  : "Som desativado — clique para ativar"
              }
              aria-label={
                soundEnabled
                  ? "Desativar som de novos pedidos"
                  : "Ativar som de novos pedidos"
              }
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors disabled:opacity-50"
              title="Atualizar"
              aria-label="Atualizar pedidos"
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", refreshing && "animate-spin")}
              />
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full h-9 pl-8 pr-3 rounded-lg bg-[#F7F8FC] border border-[#E5E7EB] text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#C8285F]/25 focus:border-[#C8285F]/30"
          />
        </div>

        {/* Auto-aceite compacto */}
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-xs text-[#6B7280] truncate">
            Aceite automático
          </span>
          <Switch
            checked={autoAccept}
            disabled={autoAcceptLoading}
            onCheckedChange={onAutoAcceptChange}
            className="data-[state=checked]:bg-[#C8285F] data-[state=unchecked]:bg-[#D1D5DB] h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
            aria-label="Aceitar pedidos automaticamente"
          />
        </div>

        {/* Contadores enxutos em linha */}
        <div className="flex items-center gap-3 text-[11px] text-[#6B7280] px-0.5">
          <span>
            <strong className="text-[#C8285F] tabular-nums">
              {counters.novos}
            </strong>{" "}
            novos
          </span>
          <span className="text-[#E5E7EB]">·</span>
          <span>
            <strong className="text-blue-600 tabular-nums">
              {counters.emPreparo}
            </strong>{" "}
            preparo
          </span>
          <span className="text-[#E5E7EB]">·</span>
          <span>
            <strong className="text-orange-600 tabular-nums">
              {counters.entrega}
            </strong>{" "}
            entrega
          </span>
        </div>

        {/* Abas */}
        <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-[#F3F4F6]">
          <button
            type="button"
            onClick={() => setTab("agora")}
            className={cn(
              "h-8 rounded-md text-xs font-semibold transition-all",
              tab === "agora"
                ? "bg-white text-[#C8285F] shadow-sm"
                : "text-[#6B7280] hover:text-[#111827]"
            )}
          >
            Agora
            {agoraPedidos.length > 0 && (
              <span className="ml-1 tabular-nums opacity-60">
                {agoraPedidos.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("concluidos")}
            className={cn(
              "h-8 rounded-md text-xs font-semibold transition-all",
              tab === "concluidos"
                ? "bg-white text-[#C8285F] shadow-sm"
                : "text-[#6B7280] hover:text-[#111827]"
            )}
          >
            Concluídos
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-2.5">
        {groups.length === 0 ? (
          <div className="text-center py-12 px-3">
            <p className="text-sm text-[#6B7280]">
              {tab === "agora"
                ? "Nenhum pedido em andamento"
                : "Nenhum pedido concluído"}
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <OrderGroup
              key={g.key}
              groupKey={g.key}
              label={g.label}
              pedidos={g.pedidos}
              isOpen={isGroupOpen(g.key)}
              onToggle={() => toggleGroup(g.key)}
              selectedId={selectedId}
              highlightedIds={highlightedIds}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}

export { SOUND_KEY };
