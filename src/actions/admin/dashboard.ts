"use server";

import { rotuloPagamento } from "@/lib/pagamento";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { requirePageAccess } from "@/lib/admin/auth";

export type DashboardPeriod = "hoje" | "ontem" | "7d" | "30d";

type PedidoRow = {
  id: string | number;
  total: number;
  status: string;
  created_at: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  meio_pagamento?: string | null;
  endereco_completo?: unknown;
  itens?: unknown;
};

const OPEN_STATUSES = new Set([
  "pendente",
  "confirmado",
  "preparando",
  "saiu_entrega",
]);

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function periodRange(
  period: DashboardPeriod,
  now = new Date()
): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  switch (period) {
    case "ontem": {
      const start = addDays(today, -1);
      return {
        start,
        end: today,
        prevStart: addDays(start, -1),
        prevEnd: start,
      };
    }
    case "7d": {
      const start = addDays(today, -6);
      return {
        start,
        end: tomorrow,
        prevStart: addDays(start, -7),
        prevEnd: start,
      };
    }
    case "30d": {
      const start = addDays(today, -29);
      return {
        start,
        end: tomorrow,
        prevStart: addDays(start, -30),
        prevEnd: start,
      };
    }
    case "hoje":
    default:
      return {
        start: today,
        end: tomorrow,
        prevStart: addDays(today, -1),
        prevEnd: today,
      };
  }
}

function inRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function changePct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function sumTotal(orders: PedidoRow[]) {
  return orders.reduce((s, o) => s + Number(o.total || 0), 0);
}

function mapRecentOrder(order: PedidoRow) {
  return {
    id: String(order.id),
    cliente: order.cliente_nome || "Cliente",
    pagamento: rotuloPagamento(order.meio_pagamento),
    status: order.status || "pendente",
    createdAt: order.created_at,
    valor: Number(order.total || 0),
  };
}

export type DashboardData = {
  storeName: string;
  period: DashboardPeriod;
  generatedAt: string;
  kpis: {
    pedidos: number;
    pedidosChange: number;
    faturamento: number;
    faturamentoChange: number;
    ticketMedio: number;
    ticketMedioChange: number;
    emAberto: number;
  };
  salesByDay: { label: string; receita: number; pedidos: number }[];
  hourly: { hora: string; pedidos: number }[];
  payments: { name: string; value: number; percentage: number }[];
  topProducts: { nome: string; quantidade: number; receita: number }[];
  recentOrders: ReturnType<typeof mapRecentOrder>[];
};

/**
 * Snapshot da dashboard por período.
 * Agrega em memória a partir de uma janela de pedidos.
 */
export async function getDashboardData(
  period: DashboardPeriod = "hoje"
): Promise<DashboardData> {
  await requirePageAccess("dashboard");
  const supabase = createServiceRoleClient();
  const now = new Date();
  const { start, end, prevStart, prevEnd } = periodRange(period, now);

  // Busca o suficiente para período atual + anterior + open orders
  const fetchFrom = new Date(
    Math.min(prevStart.getTime(), addDays(startOfDay(now), -30).getTime())
  );

  const [{ data: ordersWindow }, { data: store }, { data: recentOrders }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "id, total, status, created_at, cliente_id, cliente_nome, meio_pagamento, endereco_completo, itens"
        )
        .gte("created_at", fetchFrom.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("configuracoes_loja")
        .select("nome")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("pedidos")
        .select(
          "id, total, status, created_at, cliente_nome, meio_pagamento, endereco_completo"
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const allOrders = (ordersWindow || []) as PedidoRow[];

  const current = allOrders.filter((o) => inRange(o.created_at, start, end));
  const previous = allOrders.filter((o) =>
    inRange(o.created_at, prevStart, prevEnd)
  );

  // Em aberto: sempre situação atual da operação (não depende do filtro)
  const emAberto = allOrders.filter((o) =>
    OPEN_STATUSES.has(String(o.status || ""))
  ).length;

  // Também conta abertos recentes se não estiverem na janela fetchFrom
  // (fetchFrom cobre 30d+, suficiente)

  const faturamento = sumTotal(current);
  const faturamentoPrev = sumTotal(previous);
  const pedidos = current.length;
  const pedidosPrev = previous.length;
  const ticketMedio = pedidos > 0 ? faturamento / pedidos : 0;
  const ticketPrev = pedidosPrev > 0 ? faturamentoPrev / pedidosPrev : 0;

  // Vendas por dia no período
  const salesByDay: DashboardData["salesByDay"] = [];
  {
    const cursor = new Date(start);
    while (cursor < end) {
      const dayStart = startOfDay(cursor);
      const dayEnd = addDays(dayStart, 1);
      const dayOrders = current.filter((o) =>
        inRange(o.created_at, dayStart, dayEnd)
      );
      const isSingleDay = period === "hoje" || period === "ontem";
      salesByDay.push({
        label: isSingleDay
          ? dayStart.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
            }) // won't use for single day series below
          : dayStart.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
        receita: sumTotal(dayOrders),
        pedidos: dayOrders.length,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Para hoje/ontem: gráfico por hora em vez de um ponto
  let salesSeries = salesByDay;
  if (period === "hoje" || period === "ontem") {
    const buckets: { label: string; receita: number; pedidos: number }[] = [];
    for (let h = 8; h <= 23; h++) {
      const hourOrders = current.filter(
        (o) => new Date(o.created_at).getHours() === h
      );
      buckets.push({
        label: `${String(h).padStart(2, "0")}h`,
        receita: sumTotal(hourOrders),
        pedidos: hourOrders.length,
      });
    }
    salesSeries = buckets;
  }

  // Pedidos por horário (sempre no período filtrado)
  const hourlyMap: Record<number, number> = {};
  for (let i = 0; i < 24; i++) hourlyMap[i] = 0;
  for (const o of current) {
    hourlyMap[new Date(o.created_at).getHours()]++;
  }
  const hourly = Object.entries(hourlyMap)
    .filter(([h]) => parseInt(h, 10) >= 8 && parseInt(h, 10) <= 23)
    .map(([h, count]) => ({
      hora: `${String(h).padStart(2, "0")}h`,
      pedidos: count,
    }));

  // Pagamentos
  const payMap: Record<string, number> = {};
  for (const o of current) {
    const key = o.meio_pagamento?.trim() ? rotuloPagamento(o.meio_pagamento.trim()) : "Outro";
    payMap[key] = (payMap[key] || 0) + Number(o.total || 0);
  }
  const payTotal = Object.values(payMap).reduce((a, b) => a + b, 0);
  const payments = Object.entries(payMap)
    .map(([name, value]) => ({
      name,
      value,
      percentage: payTotal > 0 ? Math.round((value / payTotal) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Top produtos
  type Item = {
    qty?: number;
    total?: number;
    produto?: { id?: string | number; name?: string };
  };
  const productMap: Record<
    string,
    { nome: string; quantidade: number; receita: number }
  > = {};
  for (const order of current) {
    const itens = (Array.isArray(order.itens) ? order.itens : []) as Item[];
    for (const item of itens) {
      const id = String(item.produto?.id ?? item.produto?.name ?? "x");
      const nome = item.produto?.name || "Produto";
      if (!productMap[id]) {
        productMap[id] = { nome, quantidade: 0, receita: 0 };
      }
      productMap[id].quantidade += item.qty || 1;
      productMap[id].receita += Number(item.total || 0);
    }
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 8);

  return {
    storeName:
      (store as { nome?: string } | null)?.nome?.trim() || "Sorvetes Donda",
    period,
    generatedAt: now.toISOString(),
    kpis: {
      pedidos,
      pedidosChange: changePct(pedidos, pedidosPrev),
      faturamento,
      faturamentoChange: changePct(faturamento, faturamentoPrev),
      ticketMedio,
      ticketMedioChange: changePct(ticketMedio, ticketPrev),
      emAberto,
    },
    salesByDay: salesSeries,
    hourly,
    payments,
    topProducts,
    recentOrders: ((recentOrders || []) as PedidoRow[]).map(mapRecentOrder),
  };
}
