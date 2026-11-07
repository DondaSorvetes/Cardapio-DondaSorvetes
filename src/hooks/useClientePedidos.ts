"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  invalidateCustomerOrderDetail,
  useCustomerResource,
} from "@/lib/customer-resource";
export type ClientePedidoItem = {
  uid?: string;
  qty: number;
  produto: {
    id: string;
    name: string;
    price: number;
    image?: string;
  };
  total: number;
  observacoes?: string;
  /** "Deseja colher?" — ausente quando o produto não pergunta. */
  colher?: boolean;
  adicionais?: Array<{
    name: string;
    price: number;
    groupName?: string;
  }>;
  selections?:
    Record<string, string[]> | Array<{ name: string; price: number }>;
};

export type ClientePedido = {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  tipo_entrega: string;
  /** Retirada agendada (início da janela). */
  agendado_para?: string | null;
  endereco_completo: string | Record<string, unknown> | null;
  meio_pagamento: string;
  troco_para: string | number | null;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  itens: ClientePedidoItem[];
  status: string;
  /** Primeiro nome de quem está levando (só depois que saiu para entrega). */
  entregador_nome?: string | null;
  created_at: string;
  updated_at?: string;
};

export type ClientePedidoResumo = Pick<
  ClientePedido,
  "id" | "status" | "created_at" | "updated_at" | "total"
> & { itens: Array<{ produto: { name: string; image?: string } }> };
export function useClientePedidos(clienteId: string | null | undefined) {
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<{
    owner: typeof clienteId;
    pedidos: ClientePedidoResumo[];
  }>({ owner: clienteId, pedidos: [] });
  const first = useCustomerResource<{
    pedidos: ClientePedidoResumo[];
    hasMore: boolean;
  }>(clienteId, "/api/pedidos/listar?page=0");
  const older = useCustomerResource<{
    pedidos: ClientePedidoResumo[];
    hasMore: boolean;
  }>(page > 0 ? clienteId : null, "/api/pedidos/listar?page=" + page);
  const result = page > 0 ? older : first;
  const summary = useCustomerResource<{
    updates?: Array<{ id: string; status: string; updated_at?: string }>;
  }>(clienteId, "/api/cliente/resumo");
  useEffect(() => {
    if (!summary.data?.updates?.length) return;
    const updates = new Map(summary.data.updates.map((row) => [row.id, row]));
    setHistory((current) =>
      current.owner === clienteId
        ? {
            ...current,
            pedidos: current.pedidos.map((row) =>
              updates.has(row.id) ? { ...row, ...updates.get(row.id) } : row,
            ),
          }
        : current,
    );
  }, [summary.data, clienteId]);
  const previous = useRef<{
    owner: typeof clienteId;
    rows: ClientePedidoResumo[];
  }>({ owner: clienteId, rows: [] });
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPage(0);
    setHistory({ owner: clienteId, pedidos: [] });
    previous.current = { owner: clienteId, rows: [] };
    setFlashIds(new Set());
  }, [clienteId]);
  useEffect(() => {
    if (!first.data) return;
    const incoming = first.data.pedidos;
    const old =
      previous.current.owner === clienteId ? previous.current.rows : [];
    const changed = new Set<string>();
    for (const pedido of incoming) {
      if (clienteId)
        invalidateCustomerOrderDetail(
          clienteId,
          pedido.id,
          pedido.status + ":" + (pedido.updated_at ?? ""),
        );
      const before = old.find((p) => p.id === pedido.id);
      if (before && before.status !== pedido.status) {
        changed.add(pedido.id);
        toast.message("Status atualizado", {
          description:
            "#" + pedido.id.slice(0, 8).toUpperCase() + " · " + pedido.status,
        });
      } else if (old.length && !before) {
        changed.add(pedido.id);
        toast.success("Novo pedido registrado!");
      }
    }
    previous.current = { owner: clienteId, rows: incoming };
    setFlashIds(changed);
    setHistory((current) => {
      const rows =
        current.owner !== clienteId
          ? incoming
          : [...current.pedidos, ...incoming];
      return {
        owner: clienteId,
        pedidos: [...new Map(rows.map((row) => [row.id, row])).values()],
      };
    });
    const timer = setTimeout(() => setFlashIds(new Set()), 2500);
    return () => clearTimeout(timer);
  }, [first.data, clienteId]);
  useEffect(() => {
    if (!older.data || page === 0) return;
    setHistory((current) => ({
      owner: clienteId,
      pedidos: [
        ...new Map(
          [
            ...(current.owner === clienteId ? current.pedidos : []),
            ...older.data!.pedidos,
          ].map((row) => [row.id, row]),
        ).values(),
      ],
    }));
  }, [older.data, clienteId, page]);
  return {
    pedidos: history.owner === clienteId ? history.pedidos : [],
    loading: first.loading,
    loadingMore: result.loading,
    error: result.error || first.error,
    flashIds,
    reload: first.reload,
    hasMore: result.data?.hasMore ?? false,
    loadMore: () => setPage((p) => p + 1),
  };
}
export function useClientePedido(clienteId: string, id: string) {
  const result = useCustomerResource<{ pedido: ClientePedido }>(
    clienteId,
    "/api/pedidos/detalhe?id=" + encodeURIComponent(id),
  );
  return {
    pedido: result.data?.pedido,
    loading: result.loading,
    error: result.error,
  };
}
export function useClientePedidosCount(clienteId: string) {
  const result = useCustomerResource<{ count: number }>(
    clienteId,
    "/api/cliente/resumo",
  );
  return { count: result.data?.count ?? 0, loading: result.loading };
}
