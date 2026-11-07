"use client";

import {
  SlidersHorizontal,
  RefreshCw,
  Volume2,
  VolumeX,
  Search,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  KANBAN_COLUMNS,
  DEFAULT_FILTERS,
  type PedidosFilters,
} from "./kanban-columns";

interface PedidosToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filters: PedidosFilters;
  onFiltersChange: (f: PedidosFilters) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  soundEnabled: boolean;
  onSoundChange: (v: boolean) => void;
  autoAccept: boolean;
  autoAcceptLoading?: boolean;
  onAutoAcceptChange: (v: boolean) => void;
  canManageStore?: boolean;
  totalCount: number;
}

export function PedidosToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  onRefresh,
  refreshing,
  soundEnabled,
  onSoundChange,
  autoAccept,
  autoAcceptLoading,
  onAutoAcceptChange,
  canManageStore = false,
}: PedidosToolbarProps) {
  const activeFilters =
    Number(filters.status !== DEFAULT_FILTERS.status) +
    Number(filters.pagamento !== DEFAULT_FILTERS.pagamento) +
    Number(filters.periodo !== DEFAULT_FILTERS.periodo);
  const iconButton =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
  const filterClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <div className="shrink-0 border-b border-border bg-white px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap">
        <div
          role="group"
          aria-label="Modalidade do pedido"
          className="flex w-full shrink-0 rounded-lg bg-muted/70 p-1 sm:w-auto"
        >
          {(
            [
              ["todos", "Todos"],
              ["delivery", "Delivery"],
              ["retirada", "Retirada"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.tipo === value}
              onClick={() => onFiltersChange({ ...filters, tipo: value })}
              className={cn(
                "h-9 flex-1 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none",
                filters.tipo === value
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[160px] flex-1 xl:max-w-[320px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label="Buscar pedido ou cliente"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar pedido ou cliente"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 xl:ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <SlidersHorizontal aria-hidden="true" size={15} /> Filtros
                {activeFilters > 0 && (
                  <span
                    aria-label={`${activeFilters} filtros ativos`}
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1 text-xs text-primary"
                  >
                    {activeFilters}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[280px] space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Filtrar pedidos</h2>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground"
                  disabled={!activeFilters}
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      status: DEFAULT_FILTERS.status,
                      pagamento: DEFAULT_FILTERS.pagamento,
                      periodo: DEFAULT_FILTERS.periodo,
                    })
                  }
                >
                  Limpar filtros
                </button>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="orders-status" className="text-xs font-medium">
                  Status
                </label>
                <select
                  id="orders-status"
                  className={filterClass}
                  value={filters.status}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      status: event.target.value as PedidosFilters["status"],
                    })
                  }
                >
                  <option value="todos">Todos os status</option>
                  {KANBAN_COLUMNS.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="orders-payment" className="text-xs font-medium">
                  Pagamento
                </label>
                <select
                  id="orders-payment"
                  className={filterClass}
                  value={filters.pagamento}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      pagamento: event.target.value,
                    })
                  }
                >
                  <option value="todos">Todos os pagamentos</option>
                  <option value="pix">PIX</option>
                  <option value="cartão">Cartão</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="orders-period" className="text-xs font-medium">
                  Período
                </label>
                <select
                  id="orders-period"
                  className={filterClass}
                  value={filters.periodo}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      periodo: event.target.value as PedidosFilters["periodo"],
                    })
                  }
                >
                  <option value="hoje">Hoje</option>
                  <option value="24h">24 horas</option>
                  <option value="7d">7 dias</option>
                  <option value="todos">Todos os períodos</option>
                </select>
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            className={iconButton}
            title={
              soundEnabled
                ? "Silenciar novos pedidos"
                : "Ativar som de novos pedidos"
            }
            aria-label={
              soundEnabled
                ? "Silenciar novos pedidos"
                : "Ativar som de novos pedidos"
            }
            aria-pressed={soundEnabled}
            onClick={() => onSoundChange(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            type="button"
            className={iconButton}
            title="Atualizar pedidos"
            aria-label="Atualizar pedidos"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
          </button>
          {canManageStore && (
            <label className="ml-1 flex min-h-10 items-center gap-2 border-l border-border pl-3 text-xs text-muted-foreground">
              <span>
                Aceite auto{" "}
                <span className="sr-only">
                  {autoAccept ? "ligado" : "desligado"}
                </span>
              </span>
              <Switch
                aria-label="Aceitar pedidos automaticamente"
                checked={autoAccept}
                disabled={autoAcceptLoading}
                onCheckedChange={onAutoAcceptChange}
                className="h-5 w-9 data-[state=checked]:bg-primary [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
