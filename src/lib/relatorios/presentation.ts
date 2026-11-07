import type {
  ClienteRank,
  KpiCard,
  RelatorioFiltros,
} from "@/types/relatorios";

export const reportMoney = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const reportNumber = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
export function reportDate(value: string, short = false) {
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-03:00` : value,
  );
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        ...(short ? {} : { year: "numeric" }),
      });
}
export function reportDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function primaryReportKpis(kpis: KpiCard[]) {
  const primary = ["faturamento", "pedidos", "ticket", "clientes"].flatMap(
    (key) => kpis.find((k) => k.key === key) ?? [],
  );
  return primary.length ? primary : kpis.slice(0, 4);
}
export function validReportTrend(kpi: KpiCard) {
  return typeof kpi.comparisonBase === "number" &&
    kpi.comparisonBase > 0 &&
    typeof kpi.trend === "number" &&
    Number.isFinite(kpi.trend)
    ? kpi.trend
    : null;
}
const labels: Record<string, string> = {
  pendente: "Novo",
  preparando: "Em preparo",
  saiu_entrega: "Saiu para entrega",
  entregue: "Finalizado",
  cancelado: "Cancelado",
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  entrega: "Entrega",
  delivery: "Entrega",
  retirada: "Retirada",
  mesa: "Mesa",
};
export const reportValueLabel = (value: string) => labels[value] ?? value;
export function reportFilterLabels(filters?: RelatorioFiltros) {
  if (!filters) return [];
  return [
    ["Status", filters.status],
    ["Pagamento", filters.meio_pagamento],
    ["Canal", filters.tipo_entrega],
    ["Cliente", filters.cliente],
    ["Produto", filters.produto],
    ["Cidade", filters.cidade],
    ["Bairro", filters.bairro],
  ].flatMap(([label, value]) =>
    value && value !== "todos" ? [`${label}: ${reportValueLabel(value)}`] : [],
  );
}
export function reportClientStats(clients: ClienteRank[]) {
  const totalOrders = clients.reduce((sum, c) => sum + c.pedidos, 0);
  return {
    single: clients.filter((c) => c.pedidos === 1).length,
    repeat: clients.filter((c) => c.pedidos >= 2).length,
    frequency: clients.length ? totalOrders / clients.length : 0,
    ticket: clients.length
      ? clients.reduce((sum, c) => sum + c.ticketMedio, 0) / clients.length
      : 0,
  };
}
