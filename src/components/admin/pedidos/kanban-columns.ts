import type { Pedido, PedidoStatus } from "@/types/pedido";
import { isDeliveryType, isPickupType } from "./order-status";

/** Colunas do quadro Kanban de operação */
export type KanbanColumnId =
  "em_aberto" | "em_producao" | "pronto_retirada" | "saiu_entrega" | "finalizados";

export type KanbanColumnDef = {
  id: KanbanColumnId;
  label: string;
  /** Barra lateral sutil */
  accent: string;
  /** Status gravado ao soltar o card nesta coluna */
  dropStatus: PedidoStatus;
};

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: "em_aberto",
    label: "Novos",
    accent: "bg-[#C8285F]",
    dropStatus: "pendente",
  },
  {
    id: "em_producao",
    label: "Em preparo",
    accent: "bg-blue-500",
    dropStatus: "preparando",
  },
  {
    id: "pronto_retirada",
    label: "Pronto para retirada",
    accent: "bg-violet-500",
    dropStatus: "saiu_entrega",
  },
  {
    id: "saiu_entrega",
    label: "Saiu pra entrega",
    accent: "bg-orange-500",
    dropStatus: "saiu_entrega",
  },
  {
    id: "finalizados",
    label: "Concluídos",
    accent: "bg-emerald-500",
    dropStatus: "entregue",
  },
];

/**
 * Em Aberto → Em Produção → Saiu p/ Entrega (delivery) → Finalizados
 * Retirada: Em Produção → Pronto para retirada → Finalizados
 */
export function getPedidoColumnId(pedido: Pedido): KanbanColumnId {
  switch (pedido.status) {
    case "pendente":
    case "confirmado":
      return "em_aberto";
    case "preparando":
      return "em_producao";
    case "saiu_entrega":
      return isPickupType(pedido.tipo_entrega) ? "pronto_retirada" : "saiu_entrega";
    case "entregue":
    case "cancelado":
      return "finalizados";
    default:
      return "em_aberto";
  }
}

/** Status efetivo ao soltar em uma coluna (considera tipo de entrega) */
export function resolveDropStatus(
  columnId: KanbanColumnId,
  pedido: Pedido,
): PedidoStatus {
  const col = KANBAN_COLUMNS.find((c) => c.id === columnId);
  if (!col) return pedido.status;

  if (columnId === "em_producao") {
    return "preparando";
  }

  // Retirada não "sai para entrega" e entrega não fica "pronta para retirada".
  const pickup = isPickupType(pedido.tipo_entrega);
  if (columnId === "saiu_entrega" && pickup) return pedido.status;
  if (columnId === "pronto_retirada" && !pickup) return pedido.status;

  if (columnId === "finalizados") {
    // Não reabre cancelados via drop; cancelados ficam cancelados
    if (pedido.status === "cancelado") return "cancelado";
    return "entregue";
  }

  return col.dropStatus;
}

export function groupPedidosByColumn(
  pedidos: Pedido[],
): Record<KanbanColumnId, Pedido[]> {
  const map: Record<KanbanColumnId, Pedido[]> = {
    em_aberto: [],
    em_producao: [],
    pronto_retirada: [],
    saiu_entrega: [],
    finalizados: [],
  };

  for (const p of pedidos) {
    map[getPedidoColumnId(p)].push(p);
  }

  // Ordena cada coluna: mais antigos primeiro (operacional)
  for (const id of Object.keys(map) as KanbanColumnId[]) {
    map[id].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    // Finalizados: mais recentes primeiro
    if (id === "finalizados") {
      map[id].sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime(),
      );
    }
  }

  return map;
}

export type PedidosFilters = {
  status: "todos" | KanbanColumnId;
  pagamento: string; // "todos" | valor
  tipo: "todos" | "delivery" | "retirada";
  periodo: "hoje" | "24h" | "7d" | "todos";
};

export const DEFAULT_FILTERS: PedidosFilters = {
  status: "todos",
  pagamento: "todos",
  tipo: "todos",
  periodo: "hoje",
};

export function filterPedidos(
  pedidos: Pedido[],
  search: string,
  filters: PedidosFilters,
): Pedido[] {
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const now = Date.now();

  return pedidos.filter((p) => {
    // Período
    if (filters.periodo !== "todos") {
      const t = new Date(p.created_at).getTime();
      if (!Number.isFinite(t)) return false;
      if (filters.periodo === "hoje") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (t < start.getTime()) return false;
      } else if (filters.periodo === "24h") {
        if (now - t > 24 * 60 * 60 * 1000) return false;
      } else if (filters.periodo === "7d") {
        if (now - t > 7 * 24 * 60 * 60 * 1000) return false;
      }
    }

    // Coluna/status
    if (filters.status !== "todos") {
      if (getPedidoColumnId(p) !== filters.status) return false;
    }

    // Tipo
    if (filters.tipo !== "todos") {
      if (filters.tipo === "delivery" && !isDeliveryType(p.tipo_entrega))
        return false;
      if (filters.tipo === "retirada" && !isPickupType(p.tipo_entrega))
        return false;
    }

    // Pagamento
    if (filters.pagamento !== "todos") {
      const mp = (p.meio_pagamento || "").toLowerCase();
      if (!mp.includes(filters.pagamento.toLowerCase())) return false;
    }

    if (!q) return true;

    // Busca: número, nome, telefone, endereço, produto, observação
    const hay = [
      p.id,
      p.cliente_nome,
      p.cliente_telefone,
      p.endereco_completo,
      p.meio_pagamento,
      p.observacoes,
      ...p.itens.map((i) => i.produto?.name || ""),
      ...p.itens.map((i) => i.observacoes || ""),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (hay.includes(q)) return true;
    if (
      qDigits &&
      (p.cliente_telefone || "").replace(/\D/g, "").includes(qDigits)
    )
      return true;
    if (qDigits && p.id.replace(/\D/g, "").includes(qDigits)) return true;

    return false;
  });
}

export function paymentBadgeLabel(meio: string | undefined): string {
  const m = (meio || "").toLowerCase();
  if (m.includes("pix")) return "PIX";
  if (m.includes("débito") || m.includes("debito")) return "Débito";
  if (m.includes("crédito") || m.includes("credito")) return "Crédito";
  if (m.includes("cartão") || m.includes("cartao")) return "Cartão";
  if (m.includes("dinheiro")) return "Dinheiro";
  if (!meio) return "—";
  return meio.length > 12 ? meio.slice(0, 12) + "…" : meio;
}
