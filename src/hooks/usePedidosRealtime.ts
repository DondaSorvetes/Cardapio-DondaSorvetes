"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { listPedidosAdmin } from "@/actions/admin/pedidos";
import { toast } from "sonner";

export type RealtimeConnectionStatus = "connecting" | "live" | "error";

export type PedidoRow = {
  id: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  tipo_entrega?: string | null;
  endereco_completo?: unknown;
  meio_pagamento?: string | null;
  troco_para?: number | string | null;
  subtotal?: number | null;
  taxa_entrega?: number | null;
  total?: number | null;
  itens?: unknown;
  status?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

const CHANNEL_NAME = "admin-pedidos";
const HIGHLIGHT_MS = 6000;

// Re-export do módulo de som (configurações do estabelecimento + painel)
export {
  unlockPedidosAudio,
  setPedidosSoundEnabled,
  getPedidosSoundEnabled,
  playNewOrderSound,
  applySoundPreferences,
  setPedidosSoundVolume,
  setPedidosSoundType,
} from "@/lib/admin/order-alert-sound";

import { playNewOrderSound } from "@/lib/admin/order-alert-sound";

/**
 * Realtime puro para a tabela `pedidos`.
 * - INSERT → prepend no state (sem refetch)
 * - UPDATE → patch só do item
 * - DELETE → remove do state
 * Sem polling / setInterval / refetch periódico.
 */
export function usePedidosRealtime(pedidosIniciais: PedidoRow[]) {
  // Snapshot inicial do SSR/RSC; daqui pra frente só payload Realtime
  const [pedidos, setPedidosState] = useState<PedidoRow[]>(() => pedidosIniciais);
  const [status, setStatus] =
    useState<RealtimeConnectionStatus>("connecting");
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(
    () => new Set()
  );

  const supabase = createClient();
  const announcedIds = useRef(new Set(pedidosIniciais.map(row => row.id)));
  const mountedAt = useRef(Date.now());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const clearHighlight = useCallback((id: string) => {
    setHighlightedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const timer = highlightTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      highlightTimersRef.current.delete(id);
    }
  }, []);

  const markHighlight = useCallback(
    (id: string) => {
      setHighlightedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      const existing = highlightTimersRef.current.get(id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        clearHighlight(id);
      }, HIGHLIGHT_MS);
      highlightTimersRef.current.set(id, timer);
    },
    [clearHighlight]
  );

  // Lista inicial só no useState — Realtime cuida do resto.
  // Não re-sincronizar com pedidosIniciais para não sobrescrever inserts ao vivo.

  useEffect(() => {
    let alive = true;
    let recovering = false;
    let realtimeHealthy = false;
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    const journal = new Map<string, PedidoRow | null>();
    const recover = async () => {
      if (!alive || recovering || document.visibilityState === "hidden") return;
      recovering = true; journal.clear();
      try {
        const snapshot = await listPedidosAdmin(150);
        if (!alive) return;
        const replay = new Map(journal);
        setPedidosState(current => {
          const merged = new Map(snapshot.map(row => [row.id, row as PedidoRow]));
          for (const row of current) {
            const recovered = merged.get(row.id);
            if (recovered && Date.parse(row.updated_at ?? "") > Date.parse(recovered.updated_at ?? "")) merged.set(row.id, row);
          }
          for (const [id, row] of replay) { if (row) merged.set(id, row); else merged.delete(id); }
          return [...merged.values()].sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
        });
        for (const row of snapshot) {
          if (!announcedIds.current.has(row.id) && Date.parse(row.created_at) >= mountedAt.current) {
            markHighlight(row.id); void playNewOrderSound(); toast.success("Novo pedido recebido!");
          }
          announcedIds.current.add(row.id);
        }
      } catch { if (alive) setStatus("error"); }
      finally {
        recovering = false; journal.clear();
        if (alive && !realtimeHealthy) recoveryTimer = setTimeout(() => void recover(), 30_000);
      }
    };
    const resume = () => { clearTimeout(recoveryTimer); recoveryTimer = setTimeout(() => void recover(), 500); };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    // One snapshot on connection/reconnection recovers events missed while offline.
    // No idle HTTP polling is added.
    // Canal único e estável
    const channel = supabase
      .channel(CHANNEL_NAME + "-" + crypto.randomUUID())
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pedidos",
        },
        (payload) => {
          const row = payload.new as PedidoRow;
          if (!alive || !row?.id) return;
          if (recovering) journal.set(row.id, row);

          setPedidosState((prev) => {
            // idempotência: se já existe, substitui; senão, topo da lista
            const idx = prev.findIndex((p) => p.id === row.id);
            if (idx !== -1) {
              if (Date.parse(prev[idx].updated_at ?? "") > Date.parse(row.updated_at ?? "")) return prev;
              const copy = prev.slice();
              copy[idx] = row;
              return copy;
            }
            return [row, ...prev];
          });

          if (announcedIds.current.has(row.id)) return;
          announcedIds.current.add(row.id);
          markHighlight(row.id);
          void playNewOrderSound();
          const autoAceito = row.status === "preparando";
          toast.success(
            autoAceito
              ? "Novo pedido (aceito automaticamente)"
              : "Novo pedido recebido!",
            {
              description: row.cliente_nome
                ? `${row.cliente_nome} · R$ ${Number(row.total || 0)
                    .toFixed(2)
                    .replace(".", ",")}${autoAceito ? " · Em preparo" : ""}`
                : autoAceito
                  ? "Já entrou em preparo"
                  : undefined,
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pedidos",
        },
        (payload) => {
          const row = payload.new as PedidoRow;
          if (!alive || !row?.id) return;
          if (recovering) journal.set(row.id, row);

          setPedidosState((prev) => {
            const idx = prev.findIndex((p) => p.id === row.id);
            if (idx === -1) {
              // pedido ainda não estava na lista (ex.: filtro de página) → inclui
              return [row, ...prev];
            }
            // atualiza somente o item alterado
            if (prev[idx] === row || Date.parse(prev[idx].updated_at ?? "") > Date.parse(row.updated_at ?? "")) return prev;
            const copy = prev.slice();
            copy[idx] = { ...prev[idx], ...row };
            return copy;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pedidos",
        },
        (payload) => {
          const old = payload.old as Partial<PedidoRow>;
          const id = old?.id;
          if (!alive || !id) return;
          if (recovering) journal.set(id, null);

          setPedidosState((prev) => {
            const next = prev.filter((p) => p.id !== id);
            return next.length === prev.length ? prev : next;
          });
          clearHighlight(id);
        }
      )
      .subscribe((subscribeStatus) => {
        if (!alive) return;
        if (subscribeStatus === "SUBSCRIBED") {
          realtimeHealthy = true;
          setStatus("live");
          resume();
        } else if (
          subscribeStatus === "CHANNEL_ERROR" ||
          subscribeStatus === "TIMED_OUT"
        ) {
          realtimeHealthy = false;
          clearTimeout(recoveryTimer); recoveryTimer = setTimeout(() => void recover(), 30_000);
          setStatus("error");
        } else if (subscribeStatus === "CLOSED") {
          setStatus("error");
        } else {
          setStatus("connecting");
        }
      });

    channelRef.current = channel;

    return () => {
      alive = false; clearTimeout(recoveryTimer);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      channelRef.current = null;
      void supabase.removeChannel(channel);
      // limpa timers de highlight
      highlightTimersRef.current.forEach((t) => clearTimeout(t));
      highlightTimersRef.current.clear();
    };
  }, [supabase, markHighlight, clearHighlight]);

  /** Atualização local otimista (ex.: mudança de status pelo admin) */
  const patchPedido = useCallback((id: string, patch: Partial<PedidoRow>) => {
    setPedidosState((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }, []);

  const replacePedido = useCallback((row: PedidoRow) => {
    setPedidosState((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id);
      if (idx === -1) return [row, ...prev];
      const copy = prev.slice();
      copy[idx] = row;
      return copy;
    });
  }, []);

  const setPedidos = useCallback((next: PedidoRow[]) => {
    setPedidosState(next);
  }, []);

  return {
    pedidos,
    status,
    highlightedIds,
    patchPedido,
    replacePedido,
    setPedidos,
  };
}
