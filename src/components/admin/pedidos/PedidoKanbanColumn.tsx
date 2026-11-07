"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Pedido } from "@/types/pedido";
import { ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PedidoKanbanCard } from "./PedidoKanbanCard";
import type { KanbanColumnDef } from "./kanban-columns";

type CardAction = Parameters<
  React.ComponentProps<typeof PedidoKanbanCard>["onAction"]
>[1];

interface PedidoKanbanColumnProps {
  column: KanbanColumnDef;
  pedidos: Pedido[];
  selectedId?: string | null;
  highlightedIds?: Set<string>;
  onOpen: (pedido: Pedido) => void;
  onAction: (pedido: Pedido, action: CardAction) => void;
  busy?: boolean;
  /** Layout vertical (lista empilhada) vs coluna Kanban */
  vertical?: boolean;
  mobileActive?: boolean;
  /** Coluna recolhida (faixa estreita); clique para abrir. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function PedidoKanbanColumn({
  column,
  pedidos,
  selectedId,
  highlightedIds,
  onOpen,
  onAction,
  busy,
  vertical = true,
  mobileActive = false,
  collapsed = false,
  onToggleCollapsed,
}: PedidoKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.id}`,
    data: { columnId: column.id },
  });

  if (vertical) {
    return (
      <section
        className={cn(
          "rounded-md border border-[#E5E7EB] bg-white overflow-hidden",
          isOver && "ring-1 ring-[#C8285F]/40",
        )}
      >
        <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#E5E7EB] bg-[#FAFAFA]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn("w-1.5 h-1.5 rounded-full shrink-0", column.accent)}
            />
            <h3 className="text-[13px] font-semibold text-[#111827]">
              {column.label}
            </h3>
          </div>
          <span className="text-[12px] font-semibold tabular-nums text-[#6B7280] bg-[#F3F4F6] min-w-[1.5rem] h-5 px-1.5 rounded flex items-center justify-center">
            {pedidos.length}
          </span>
        </header>

        <div ref={setNodeRef} className="p-2 space-y-1.5 min-h-[48px]">
          <SortableContext
            items={pedidos.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {pedidos.length === 0 ? (
              <p className="text-center text-[12px] text-[#9CA3AF] py-3">
                Nenhum pedido
              </p>
            ) : (
              pedidos.map((p) => (
                <PedidoKanbanCard
                  key={p.id}
                  pedido={p}
                  isSelected={selectedId === p.id}
                  isHighlighted={highlightedIds?.has(p.id)}
                  onOpen={onOpen}
                  onAction={onAction}
                  disabled={busy}
                  layout="row"
                />
              ))
            )}
          </SortableContext>
        </div>
      </section>
    );
  }

  // Recolhida: faixa estreita à direita. Continua aceitando cards arrastados.
  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        // No celular a coluna recolhida some; aparece ao escolher "Concluídos" no seletor.
        data-mobile-active={false}
        className={cn(
          "admin-kanban-column flex h-full w-12 shrink-0 flex-col items-center border-l border-[#F0E2E7] bg-[#FBFAFC]",
          isOver && "bg-[#FDE6EE]/40 ring-1 ring-inset ring-[#C8285F]/40",
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={false}
          aria-label={`Mostrar ${column.label} (${pedidos.length})`}
          title={`Mostrar ${column.label}`}
          className="flex h-full w-full flex-col items-center gap-3 py-3 text-[#675B70] transition-colors hover:bg-[#F4F1F7] hover:text-[#2A2033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8285F]"
        >
          <span className="flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums">
            {pedidos.length}
          </span>
          <span className="text-[13px] font-semibold [writing-mode:vertical-rl]">
            {column.label}
          </span>
        </button>
      </section>
    );
  }

  // Coluna do quadro
  return (
    <section
      data-mobile-active={mobileActive}
      className={cn(
        "admin-kanban-column flex flex-1 flex-col min-w-[240px] h-full border-r border-[#F0E2E7] bg-[#FBFAFC] last:border-r-0",
        isOver && "ring-1 ring-[#C8285F]/40 bg-[#FDE6EE]/30",
      )}
    >
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-3 border-b border-[#F0E2E7] bg-[#F4F1F7]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn("w-2 h-2 rounded-full shrink-0", column.accent)}
          />
          <h3 className="text-[13px] font-semibold text-[#2A2033] truncate">
            {column.label}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold tabular-nums text-[#675B70] bg-white min-w-[1.5rem] h-5 px-1.5 rounded-full flex items-center justify-center">
            {pedidos.length}
          </span>
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={true}
              aria-label={`Ocultar ${column.label}`}
              title={`Ocultar ${column.label}`}
              className="hidden h-6 w-6 items-center justify-center rounded text-[#9A929F] hover:bg-white hover:text-[#2A2033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F] md:inline-flex"
            >
              <ChevronsRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto overscroll-contain p-2.5 space-y-2 min-h-[120px]"
      >
        <SortableContext
          items={pedidos.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {pedidos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#F0E2E7] px-2 py-5 text-center text-[11px] text-[#9A929F]">
              Nenhum pedido
            </p>
          ) : (
            pedidos.map((p) => (
              <PedidoKanbanCard
                key={p.id}
                pedido={p}
                isHighlighted={highlightedIds?.has(p.id)}
                onOpen={onOpen}
                onAction={onAction}
                disabled={busy}
                layout="card"
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}
