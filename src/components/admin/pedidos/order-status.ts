import type { Pedido, PedidoStatus } from "@/types/pedido";

export type OrdersTab = "agora" | "concluidos";

export type StatusGroupKey =
  | "pendente"
  | "confirmado"
  | "preparando"
  | "retirada"
  | "saiu_entrega"
  | "entregue"
  | "cancelado";

export const AGORA_STATUSES: PedidoStatus[] = [
  "pendente",
  "confirmado",
  "preparando",
  "saiu_entrega",
];

export const CONCLUIDOS_STATUSES: PedidoStatus[] = ["entregue", "cancelado"];

export const STATUS_META: Record<
  PedidoStatus,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    badge: string;
    dot: string;
  }
> = {
  pendente: {
    label: "Novo",
    color: "text-[#C8285F]",
    bg: "bg-[#FDF0F4]",
    border: "border-[#C8285F]",
    badge: "bg-[#FDE6EE] text-[#C8285F] border-[#F6BFD2]",
    dot: "bg-[#C8285F]",
  },
  confirmado: {
    label: "Confirmado",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-400",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  preparando: {
    label: "Em preparo",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-400",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  saiu_entrega: {
    label: "Saiu para entrega",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-400",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  entregue: {
    label: "Concluído",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  cancelado: {
    label: "Cancelado",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-400",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export function isDeliveryType(tipo: string | undefined | null): boolean {
  return tipo === "delivery" || tipo === "entrega";
}

export function isPickupType(tipo: string | undefined | null): boolean {
  return tipo === "retirada";
}

export function tipoEntregaLabel(tipo: string | undefined | null): string {
  if (isDeliveryType(tipo)) return "Entrega";
  return "Retirada";
}

/**
 * Retirada não sai para entrega: o status "saiu_entrega" significa
 * "Pronto para retirada" e "entregue" significa "Retirado".
 */
export function statusLabel(
  status: PedidoStatus,
  tipo: string | undefined | null,
): string {
  if (isPickupType(tipo)) {
    if (status === "saiu_entrega") return "Pronto para retirada";
    if (status === "entregue") return "Retirado";
  }
  return STATUS_META[status]?.label ?? status;
}

export function shortOrderId(id: string): string {
  // Prefere últimos 4 dígitos se houver números; senão 4 primeiros do UUID
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return id.slice(0, 4).toUpperCase();
}

export function isAgoraStatus(status: PedidoStatus): boolean {
  return AGORA_STATUSES.includes(status);
}

export function isConcluidoStatus(status: PedidoStatus): boolean {
  return CONCLUIDOS_STATUSES.includes(status);
}

/** Agrupa pedidos da aba "Agora" no estilo iFood */
export function groupAgoraOrders(pedidos: Pedido[]): {
  key: StatusGroupKey;
  label: string;
  pedidos: Pedido[];
}[] {
  const novos = pedidos.filter((p) => p.status === "pendente");
  const confirmados = pedidos.filter((p) => p.status === "confirmado");
  const emPreparo = pedidos.filter(
    (p) => p.status === "preparando" && !isPickupType(p.tipo_entrega)
  );
  const retirada = pedidos.filter(
    (p) =>
      (p.status === "preparando" || p.status === "saiu_entrega") &&
      isPickupType(p.tipo_entrega)
  );
  const saiu = pedidos.filter(
    (p) => p.status === "saiu_entrega" && !isPickupType(p.tipo_entrega)
  );

  const groups: {
    key: StatusGroupKey;
    label: string;
    pedidos: Pedido[];
  }[] = [
    { key: "pendente", label: "Novos", pedidos: novos },
    { key: "confirmado", label: "Confirmados", pedidos: confirmados },
    { key: "preparando", label: "Em preparo", pedidos: emPreparo },
    { key: "retirada", label: "Retirada", pedidos: retirada },
    { key: "saiu_entrega", label: "Saiu para entrega", pedidos: saiu },
  ];
  return groups.filter((g) => g.pedidos.length > 0);
}

export function groupConcluidosOrders(pedidos: Pedido[]): {
  key: StatusGroupKey;
  label: string;
  pedidos: Pedido[];
}[] {
  const entregues = pedidos.filter((p) => p.status === "entregue");
  const cancelados = pedidos.filter((p) => p.status === "cancelado");

  const groups: {
    key: StatusGroupKey;
    label: string;
    pedidos: Pedido[];
  }[] = [
    { key: "entregue", label: "Concluídos", pedidos: entregues },
    { key: "cancelado", label: "Cancelados", pedidos: cancelados },
  ];
  return groups.filter((g) => g.pedidos.length > 0);
}

export function countByStatus(pedidos: Pedido[]) {
  return {
    novos: pedidos.filter((p) => p.status === "pendente").length,
    emPreparo: pedidos.filter((p) => p.status === "preparando").length,
    entrega: pedidos.filter(
      (p) => p.status === "saiu_entrega" && !isPickupType(p.tipo_entrega)
    ).length,
  };
}

export type OrderAction = {
  label: string;
  status: PedidoStatus;
  variant: "primary" | "danger" | "secondary" | "success" | "warning";
  icon: "check" | "x" | "chef" | "bike" | "flag" | "package" | "print";
  /** Se true, após mudar status dispara impressão do cupom */
  printAfter?: boolean;
};

export function getOrderActions(pedido: Pedido): OrderAction[] {
  const actions: OrderAction[] = [];
  const delivery = isDeliveryType(pedido.tipo_entrega);
  const pickup = isPickupType(pedido.tipo_entrega);

  if (pedido.status === "pendente" || pedido.status === "confirmado") {
    actions.push({
      label: "Aceitar",
      status: "preparando",
      variant: "primary",
      icon: "check",
    });
    actions.push({
      label: "Aceitar e imprimir",
      status: "preparando",
      variant: "secondary",
      icon: "print",
      printAfter: true,
    });
    actions.push({
      label: "Recusar",
      status: "cancelado",
      variant: "danger",
      icon: "x",
    });
    return actions;
  }

  if (pedido.status === "preparando") {
    if (delivery) {
      actions.push({
        label: "Saiu para entrega",
        status: "saiu_entrega",
        variant: "warning",
        icon: "bike",
      });
    } else if (pickup) {
      actions.push({
        label: "Pronto para retirada",
        status: "saiu_entrega",
        variant: "success",
        icon: "package",
      });
    } else {
      actions.push({
        label: "Marcar como pronto",
        status: "entregue",
        variant: "success",
        icon: "chef",
      });
    }
  }

  if (pedido.status === "saiu_entrega") {
    actions.push({
      label: pickup ? "Cliente retirou" : "Finalizar pedido",
      status: "entregue",
      variant: "success",
      icon: "flag",
    });
  }

  if (pedido.status === "preparando" || pedido.status === "saiu_entrega") {
    actions.push({
      label: "Cancelar",
      status: "cancelado",
      variant: "danger",
      icon: "x",
    });
  }

  return actions;
}

/** Minutos decorridos desde created_at */
export function elapsedMinutes(iso: string, now = Date.now()): number {
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((now - created) / 60000));
}

export function formatElapsed(mins: number): string {
  if (mins < 60) {
    return `${String(mins).padStart(2, "0")} min`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function elapsedTone(mins: number): "ok" | "warn" | "danger" {
  if (mins >= 30) return "danger";
  if (mins >= 15) return "warn";
  return "ok";
}
