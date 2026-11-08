"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { X } from "lucide-react";
import type { Pedido } from "@/types/pedido";
import { formatEndereco } from "@/lib/utils/formatters";
import { createClient } from "@/lib/supabase/client";
import {
  enrichPedidoItens,
  type OpcaoLookup,
  type GrupoLookup,
} from "@/lib/utils/pedido";
import {
  updatePedidoStatus,
  listPedidosAdmin,
  type PedidoStatusUpdate,
} from "@/actions/admin/pedidos";
import {
  getStoreSettings,
  setAutoAcceptOrders,
} from "@/actions/admin/store-settings";
import {
  usePedidosRealtime,
  type PedidoRow,
  setPedidosSoundEnabled,
  unlockPedidosAudio,
  playNewOrderSound,
} from "@/hooks/usePedidosRealtime";
import { toast } from "sonner";
import { PedidosToolbar } from "./PedidosToolbar";
import Link from "next/link";
import { getEntregadoresResumo } from "@/actions/admin/entregadores";
import type { EntregadoresResumo } from "@/lib/entregadores";
import { PedidoKanbanColumn } from "./PedidoKanbanColumn";
import { PedidoDetailPanel } from "./PedidoDetailPanel";
import { OrderPrint, type OrderPrintTipo } from "./OrderPrint";
import { OrdersSkeleton } from "./OrdersSkeleton";
import {
  KANBAN_COLUMNS,
  DEFAULT_FILTERS,
  filterPedidos,
  groupPedidosByColumn,
  resolveDropStatus,
  getPedidoColumnId,
  type PedidosFilters,
  type KanbanColumnId,
} from "./kanban-columns";
import { shortOrderId } from "./order-status";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { PushBanner } from "@/components/admin/pwa/PushToggle";

export const SOUND_KEY = "donda-orders-sound";
const CONCLUIDOS_KEY = "donda-orders-concluidos-abertos";
const AVISO_ENTREGADOR_KEY = "donda-orders-aviso-entregador-fechado";

interface PedidosManagerProps {
  pedidosIniciais: PedidoRow[];
  autoAcceptInicial?: boolean;
  /** Admin com config:write — aceitar auto / preferências da loja */
  canManageStore?: boolean;
}

function mapPedido(
  p: PedidoRow,
  opcoes: OpcaoLookup[],
  grupos: GrupoLookup[],
): Pedido {
  const itensEnriquecidos = enrichPedidoItens(
    Array.isArray(p.itens) ? p.itens : [],
    opcoes,
    grupos,
  ) as unknown as Pedido["itens"];

  const rawStatus = (p.status as Pedido["status"]) || "pendente";

  return {
    id: p.id,
    cliente_nome: p.cliente_nome || "Cliente",
    cliente_telefone: p.cliente_telefone ?? undefined,
    tipo_entrega: (p.tipo_entrega as Pedido["tipo_entrega"]) || "delivery",
    agendado_para: typeof p.agendado_para === "string" ? p.agendado_para : null,
    endereco_completo:
      formatEndereco(
        p.endereco_completo as
          string | import("@/types/pedido").EnderecoObject | null | undefined,
      ) || undefined,
    meio_pagamento: p.meio_pagamento || "Não informado",
    troco_para: (() => {
      if (p.troco_para == null || p.troco_para === "") return undefined;
      const n = Number(p.troco_para);
      return Number.isFinite(n) ? n : undefined;
    })(),
    cupom_codigo: typeof p.cupom_codigo === "string" ? p.cupom_codigo : null,
    desconto_cupom: Number(p.desconto_cupom || 0),
    subtotal: Number(p.subtotal || 0),
    taxa_entrega: Number(p.taxa_entrega || 0),
    total: Number(p.total || 0),
    itens: itensEnriquecidos,
    status: rawStatus,
    observacoes: p.observacoes ?? undefined,
    created_at: p.created_at || new Date().toISOString(),
    updated_at: p.updated_at || p.created_at || new Date().toISOString(),
  };
}

export function PedidosManager({
  pedidosIniciais,
  autoAcceptInicial = false,
  canManageStore = false,
}: PedidosManagerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const pedidoId = new URLSearchParams(window.location.search).get("pedido");
    if (pedidoId) setSelectedId(pedidoId);
  }, []);
  const [mobileColumn, setMobileColumn] = useState<KanbanColumnId | "todos">("todos");
  // "Concluídos" começa recolhida à direita; a escolha fica salva neste navegador.
  const [concluidosAbertos, setConcluidosAbertos] = useState(false);
  useEffect(() => {
    try { setConcluidosAbertos(localStorage.getItem(CONCLUIDOS_KEY) === "1"); } catch { /* preferência opcional */ }
  }, []);
  const toggleConcluidos = () => setConcluidosAbertos((aberto) => {
    try { localStorage.setItem(CONCLUIDOS_KEY, aberto ? "0" : "1"); } catch { /* preferência opcional */ }
    return !aberto;
  });
  // Aviso "Nenhum entregador selecionado": fechado vale até fechar o navegador.
  const [avisoEntregadorFechado, setAvisoEntregadorFechado] = useState(false);
  useEffect(() => {
    try { setAvisoEntregadorFechado(sessionStorage.getItem(AVISO_ENTREGADOR_KEY) === "1"); } catch { /* opcional */ }
  }, []);
  const fecharAvisoEntregador = () => {
    setAvisoEntregadorFechado(true);
    try { sessionStorage.setItem(AVISO_ENTREGADOR_KEY, "1"); } catch { /* opcional */ }
  };
  // Entregador selecionado e nomes (para o aviso e os detalhes). Sem a migration 0019
  // ou sem permissão, fica null e nada aparece.
  const [entregadores, setEntregadores] = useState<EntregadoresResumo | null>(null);
  useEffect(() => {
    const refresh = () =>
      void getEntregadoresResumo()
        .then((r) => setEntregadores(r.ok ? r.resumo : null))
        .catch(() => {});
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const [opcoes, setOpcoes] = useState<OpcaoLookup[]>([]);
  const [grupos, setGrupos] = useState<GrupoLookup[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [autoAccept, setAutoAccept] = useState(autoAcceptInicial);
  const [autoAcceptLoading, setAutoAcceptLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<PedidosFilters>(DEFAULT_FILTERS);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [printPedido, setPrintPedido] = useState<{
    pedido: Pedido;
    tipo: OrderPrintTipo;
  } | null>(null);

  const {
    pedidos: pedidosRows,
    highlightedIds,
    patchPedido,
    replacePedido,
    setPedidos,
  } = usePedidosRealtime(pedidosIniciais);

  const sensors = useSensors(
    // Touch uses the existing explicit actions; vertical scrolling must not drag orders.
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Som
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOUND_KEY);
      if (stored != null) {
        const enabled = stored === "1" || stored === "true";
        setSoundEnabled(enabled);
        setPedidosSoundEnabled(enabled);
      } else {
        setPedidosSoundEnabled(true);
      }
    } catch {
      setPedidosSoundEnabled(true);
    }
  }, []);

  useEffect(() => {
    const unlock = () => {
      void unlockPedidosAudio();
    };
    window.addEventListener("pointerdown", unlock, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const handleSoundChange = useCallback(async (value: boolean) => {
    setSoundEnabled(value);
    setPedidosSoundEnabled(value);
    try {
      localStorage.setItem(SOUND_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
    if (value) {
      const unlocked = await unlockPedidosAudio();
      if (unlocked) {
        void playNewOrderSound();
        toast.success("Som ativado");
      } else {
        toast.error("Não foi possível ativar o som");
      }
    }
  }, []);

  // Catálogo
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    async function loadCatalogo() {
      try {
        const [{ data: ops }, { data: grps }] = await Promise.all([
          supabase
            .from("opcoes")
            .select(
              "id, nome, preco_adicional, grupo_id, grupo:grupos_opcoes(id, nome)",
            ),
          supabase.from("grupos_opcoes").select("id, nome"),
        ]);
        if (cancelled) return;
        setOpcoes((ops || []) as OpcaoLookup[]);
        setGrupos((grps || []) as GrupoLookup[]);
      } finally {
        if (!cancelled) setCatalogReady(true);
      }
    }
    void loadCatalogo();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getStoreSettings()
      .then((s) => {
        if (!cancelled) setAutoAccept(Boolean(s.auto_accept_orders));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pedidos: Pedido[] = useMemo(
    () => pedidosRows.map((p) => mapPedido(p, opcoes, grupos)),
    [pedidosRows, opcoes, grupos],
  );

  const filtered = useMemo(
    () => filterPedidos(pedidos, search, filters),
    [pedidos, search, filters],
  );

  const byColumn = useMemo(() => groupPedidosByColumn(filtered), [filtered]);

  const selectedPedido = useMemo(
    () => pedidos.find((p) => p.id === selectedId) ?? null,
    [pedidos, selectedId],
  );

  const activeDragPedido = useMemo(
    () => (activeDragId ? pedidos.find((p) => p.id === activeDragId) : null),
    [activeDragId, pedidos],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!pedidosRows.some((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [pedidosRows, selectedId]);

  // Impressão avulsa
  useEffect(() => {
    if (!printPedido) return;
    let finished = false;
    const run = () => window.print();
    const done = () => {
      if (finished) return;
      finished = true;
      setPrintPedido(null);
    };
    const t1 = window.setTimeout(run, 250);
    const t2 = window.setTimeout(done, 8000);
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("afterprint", done);
    };
  }, [printPedido]);

  const handleStatusChange = useCallback(
    async (pedidoId: string, newStatus: Pedido["status"]) => {
      const previous = pedidosRows.find((p) => p.id === pedidoId);
      setStatusBusy(true);
      patchPedido(pedidoId, {
        status: newStatus,
        updated_at: new Date().toISOString(),
      });
      try {
        const updated = await updatePedidoStatus(
          pedidoId,
          newStatus as PedidoStatusUpdate,
        );
        replacePedido(updated as PedidoRow);
        toast.success("Alterações salvas.");
        return true;
      } catch (error) {
        console.error(error);
        if (previous) replacePedido(previous);
        toast.error("Erro ao atualizar status");
        return false;
      } finally {
        setStatusBusy(false);
      }
    },
    [pedidosRows, patchPedido, replacePedido],
  );

  const handleDrawerStatusChange = useCallback(
    async (newStatus: Pedido["status"]) => {
      if (!selectedId) return false;
      return handleStatusChange(selectedId, newStatus);
    },
    [selectedId, handleStatusChange],
  );

  const handleOpen = useCallback((pedido: Pedido) => {
    detailTrigger.current = document.activeElement as HTMLElement;
    setSelectedId(pedido.id);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleCardAction = useCallback(
    (
      pedido: Pedido,
      action:
        | { type: "status"; status: Pedido["status"]; printAfter?: boolean }
        | { type: "print" }
        | { type: "details" },
    ) => {
      if (action.type === "details") {
        handleOpen(pedido);
        return;
      }
      if (action.type === "print") {
        setPrintPedido({ pedido, tipo: "completo" });
        return;
      }
      void (async () => {
        const ok = await handleStatusChange(pedido.id, action.status);
        if (ok && action.printAfter) {
          const updated = { ...pedido, status: action.status };
          setPrintPedido({ pedido: updated, tipo: "completo" });
        }
      })();
    },
    [handleOpen, handleStatusChange],
  );

  const handleAutoAcceptChange = useCallback(
    async (value: boolean) => {
      setAutoAcceptLoading(true);
      const previous = autoAccept;
      setAutoAccept(value);
      try {
        await setAutoAcceptOrders(value);
        toast.success(
          value ? "Aceite automático ativado" : "Aceite automático desativado",
        );
      } catch {
        setAutoAccept(previous);
        toast.error("Não foi possível salvar");
      } finally {
        setAutoAcceptLoading(false);
      }
    },
    [autoAccept],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await listPedidosAdmin(150);
      setPedidos(data as PedidoRow[]);
      toast.success("Lista atualizada");
    } catch {
      toast.error("Falha ao atualizar");
    } finally {
      setRefreshing(false);
    }
  }, [setPedidos]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const pedidoId = String(active.id);
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;

    let targetColumn: KanbanColumnId | null = null;
    const overId = String(over.id);

    if (overId.startsWith("col-")) {
      targetColumn = overId.replace("col-", "") as KanbanColumnId;
    } else {
      // Soltou sobre outro card
      const overPedido = pedidos.find((p) => p.id === overId);
      if (overPedido) {
        targetColumn = getPedidoColumnId(overPedido);
      }
    }

    if (!targetColumn) return;

    const currentCol = getPedidoColumnId(pedido);
    if (currentCol === targetColumn) return;

    const newStatus = resolveDropStatus(targetColumn, pedido);
    if (newStatus === pedido.status) {
      return;
    }

    await handleStatusChange(pedidoId, newStatus);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[type="search"]',
        );
        input?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!catalogReady && pedidosIniciais.length === 0) {
    return (
      <div className="admin-workspace">
        <OrdersSkeleton />
      </div>
    );
  }

  return (
    <div className="admin-workspace flex flex-col overflow-hidden bg-[#F9FAFB]">
      <PedidosToolbar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing}
        soundEnabled={soundEnabled}
        onSoundChange={(v) => void handleSoundChange(v)}
        autoAccept={autoAccept}
        autoAcceptLoading={autoAcceptLoading}
        onAutoAcceptChange={(v) => void handleAutoAcceptChange(v)}
        canManageStore={canManageStore}
        totalCount={filtered.length}
      />

      <PushBanner />

      {entregadores && !entregadores.selecionado && !avisoEntregadorFechado && (
        <div role="status" className="flex items-center gap-2 border-b border-[#F1E7C8] bg-[#FFFBEB] py-1.5 pl-4 pr-2 text-xs text-[#92400E]">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          Nenhum entregador selecionado: pedidos que saírem para entrega ficarão sem entregador.
          {canManageStore && (
            <Link href="/admin/configuracoes#entregadores" className="font-semibold underline underline-offset-2">
              Selecionar
            </Link>
          )}
        </p>
          <button
            type="button"
            onClick={fecharAvisoEntregador}
            aria-label="Fechar aviso"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#92400E]/70 hover:bg-[#FDF0C8] hover:text-[#92400E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="relative flex-1 min-h-0 min-w-0 bg-[#F7F6F9]">
        {/* Celular: etapa em chips deslizáveis (no lugar do seletor). */}
        <div
          role="group"
          aria-label="Etapa dos pedidos"
          className="orders-stage-chips flex gap-1.5 overflow-x-auto px-3 pt-3 md:hidden"
        >
          {[
            { id: "todos" as const, label: "Todos", count: filtered.length },
            ...KANBAN_COLUMNS.map((col) => ({
              id: col.id,
              label: col.label,
              count: byColumn[col.id].length,
            })),
          ].map((chip) => {
            const active = mobileColumn === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setMobileColumn(chip.id);
                  setFilters((prev) => ({ ...prev, status: "todos" }));
                }}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F] ${
                  active ? "bg-[#1F1A26] text-white" : "bg-white text-[#675B70]"
                }`}
              >
                {chip.label}
                {chip.count > 0 && (
                  <span className={`tabular-nums ${active ? "text-white/70" : "text-[#A29AAA]"}`}>
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <div className="admin-kanban-scroll h-full overflow-x-auto overflow-y-hidden p-3 sm:p-4">
            <div className={`admin-kanban-board orders-mobile-board flex h-full overflow-hidden rounded-xl border border-[#F0E2E7] bg-white shadow-sm ${concluidosAbertos ? "min-w-[1240px]" : "min-w-[1000px]"}`}>
              {KANBAN_COLUMNS.map((col) => (
                <PedidoKanbanColumn
                  key={col.id}
                  column={col}
                  pedidos={byColumn[col.id]}
                  selectedId={selectedId}
                  highlightedIds={highlightedIds}
                  onOpen={handleOpen}
                  onAction={handleCardAction}
                  busy={statusBusy}
                  vertical={false}
                  mobileActive={mobileColumn === col.id || (mobileColumn === "todos" && byColumn[col.id].length > 0)}
                  collapsed={col.id === "finalizados" && !concluidosAbertos && mobileColumn !== "finalizados"}
                  onToggleCollapsed={col.id === "finalizados" ? toggleConcluidos : undefined}
                />
              ))}
            </div>

          </div>

          {filtered.length === 0 && <div className="px-4 py-10 text-center text-sm text-[#817A89]"><p>Nenhum pedido encontrado.</p><p className="mt-1 text-xs">Os pedidos aparecerão aqui. Confira o período nos filtros.</p></div>}
          <DragOverlay>
            {activeDragPedido ? (
              <div className="w-[280px] rounded-lg border border-[#D9CBEA] bg-white px-3 py-3 shadow-xl">
                <p className="text-sm font-semibold text-[#241631]">
                  #{shortOrderId(activeDragPedido.id)}
                </p>
                <p className="truncate text-xs text-[#817A89]">
                  {activeDragPedido.cliente_nome}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <Sheet open={!!selectedPedido} onOpenChange={(open) => { if (!open) handleClose(); }}>
          <SheetContent overlayClassName="bg-black/15" className="admin-detail-sheet w-full sm:max-w-[480px] border-l border-[#F0E2E7] bg-white"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const trigger = detailTrigger.current;
              if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
              else document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
            }}>
            <SheetTitle className="sr-only">Detalhes do pedido</SheetTitle>
            <SheetDescription className="sr-only">Itens, cliente, pagamento e ações do pedido selecionado.</SheetDescription>
            {selectedPedido && (
              <PedidoDetailPanel
                pedido={selectedPedido}
                onStatusChange={handleDrawerStatusChange}
                onClose={handleClose}
                busy={statusBusy}
                entregadorNome={
                  selectedPedido.entregador_id ? (entregadores?.nomes[selectedPedido.entregador_id] ?? null) : null
                }
              />
            )}
          </SheetContent>
        </Sheet>
      </div>

      {printPedido && (
        <OrderPrint pedido={printPedido.pedido} tipo={printPedido.tipo} />
      )}
    </div>
  );
}
