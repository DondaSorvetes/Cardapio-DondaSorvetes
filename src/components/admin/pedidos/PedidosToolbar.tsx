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

const MODALIDADES = [
  ["todos", "Todos"],
  ["delivery", "Delivery"],
  ["retirada", "Retirada"],
] as const;

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
  /** No celular a modalidade também mora no painel de opções. */
  const mobileChanges = activeFilters + Number(filters.tipo !== DEFAULT_FILTERS.tipo);
  const iconButton =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
  const filterClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const soundLabel = soundEnabled
    ? "Silenciar novos pedidos"
    : "Ativar som de novos pedidos";

  const clearFilters = () =>
    onFiltersChange({
      ...filters,
      status: DEFAULT_FILTERS.status,
      pagamento: DEFAULT_FILTERS.pagamento,
      periodo: DEFAULT_FILTERS.periodo,
    });

  const modalidade = (className?: string) => (
    <div
      role="group"
      aria-label="Modalidade do pedido"
      className={cn("flex shrink-0 rounded-lg bg-muted/70 p-1", className)}
    >
      {MODALIDADES.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={filters.tipo === value}
          onClick={() => onFiltersChange({ ...filters, tipo: value })}
          className={cn(
            "h-9 flex-1 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex-none",
            filters.tipo === value
              ? "bg-white text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  /** Campos de filtro; `idPrefix` evita ids repetidos entre celular e desktop. */
  const filterFields = (idPrefix: string) => (
    <>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-status`} className="text-xs font-medium">
          Status
        </label>
        <select
          id={`${idPrefix}-status`}
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
        <label htmlFor={`${idPrefix}-payment`} className="text-xs font-medium">
          Pagamento
        </label>
        <select
          id={`${idPrefix}-payment`}
          className={filterClass}
          value={filters.pagamento}
          onChange={(event) =>
            onFiltersChange({ ...filters, pagamento: event.target.value })
          }
        >
          <option value="todos">Todos os pagamentos</option>
          <option value="pix">PIX</option>
          <option value="cartão">Cartão</option>
          <option value="dinheiro">Dinheiro</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-period`} className="text-xs font-medium">
          Período
        </label>
        <select
          id={`${idPrefix}-period`}
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
    </>
  );

  const autoAcceptSwitch = (
    <Switch
      aria-label="Aceitar pedidos automaticamente"
      checked={autoAccept}
      disabled={autoAcceptLoading}
      onCheckedChange={onAutoAcceptChange}
      className="h-5 w-9 data-[state=checked]:bg-primary [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
    />
  );

  return (
    <div className="shrink-0 border-b border-border bg-white px-3 py-2.5 sm:px-5 md:py-3">
      <div className="flex items-center gap-2 md:gap-3">
        {modalidade("hidden md:flex")}

        <div className="relative min-w-0 flex-1 xl:max-w-[320px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label="Buscar pedido ou cliente"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar pedido ou cliente"
            className="h-10 w-full rounded-full border border-transparent bg-muted/70 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-input focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:rounded-md md:border-input md:bg-background md:pl-9"
          />
        </div>

        {/* Celular: tudo que não é busca fica num único painel. */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={
                mobileChanges > 0
                  ? `Opções dos pedidos (${mobileChanges} filtros ativos)`
                  : "Opções dos pedidos"
              }
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/70 text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:bg-foreground data-[state=open]:text-background md:hidden"
            >
              <SlidersHorizontal aria-hidden="true" size={18} />
              {mobileChanges > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-white"
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[min(320px,calc(100vw-1.5rem))] space-y-4 p-4 md:hidden"
          >
            {modalidade("w-full")}
            <div className="space-y-3">{filterFields("orders-m")}</div>
            {activeFilters > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={clearFilters}
              >
                Limpar filtros
              </button>
            )}
            <div className="divide-y divide-border border-t border-border">
              <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                Som de novos pedidos
                <Switch
                  aria-label={soundLabel}
                  checked={soundEnabled}
                  onCheckedChange={onSoundChange}
                  className="h-5 w-9 data-[state=checked]:bg-primary [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                />
              </label>
              {canManageStore && (
                <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                  Aceite automático
                  {autoAcceptSwitch}
                </label>
              )}
              <button
                type="button"
                disabled={refreshing}
                onClick={onRefresh}
                className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm disabled:opacity-60"
              >
                Atualizar lista
                <RefreshCw
                  aria-hidden="true"
                  size={16}
                  className={cn("text-muted-foreground", refreshing && "animate-spin")}
                />
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Desktop: controles expandidos, como antes. */}
        <div className="hidden items-center gap-1.5 md:flex xl:ml-auto">
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
                  onClick={clearFilters}
                >
                  Limpar filtros
                </button>
              </div>
              {filterFields("orders")}
            </PopoverContent>
          </Popover>
          <button
            type="button"
            className={iconButton}
            title={soundLabel}
            aria-label={soundLabel}
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
              {autoAcceptSwitch}
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
