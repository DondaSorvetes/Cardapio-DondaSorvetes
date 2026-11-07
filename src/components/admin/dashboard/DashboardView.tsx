"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  getDashboardData,
  type DashboardData,
  type DashboardPeriod,
} from "@/actions/admin/dashboard";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  STATUS_META,
  shortOrderId,
} from "@/components/admin/pedidos/order-status";
import type { PedidoStatus } from "@/types/pedido";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import "./dashboard.css";

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
];
const money = formatCurrency;
const time = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
function statusLabel(status: string) {
  return STATUS_META[status as PedidoStatus]?.label || status;
}
function statusClass(status: string) {
  return (
    STATUS_META[status as PedidoStatus]?.badge ||
    "bg-gray-50 text-gray-600 border-gray-200"
  );
}

export function DashboardView({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState<DashboardPeriod>(initialData.period);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const load = useCallback(async (p: DashboardPeriod) => {
    setLoading(true);
    setError(false);
    try {
      setData(await getDashboardData(p));
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  const handlePeriod = (p: DashboardPeriod) => {
    setPeriod(p);
    startTransition(() => {
      void load(p);
    });
  };
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void load(period);
      }, 600);
    };
    const channel = supabase
      .channel(
        `dashboard-pedidos-${crypto.getRandomValues(new Uint32Array(4)).join("-")}`,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        schedule,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [period, load]);
  const busy = loading || isPending;
  const recent = data.recentOrders.slice(0, 6);
  const hasSales = data.salesByDay.some((d) => d.receita > 0);
  return (
    <div className="dashboard-view">
      <header className="dashboard-heading">
        <div>
          <h1>Visão geral</h1>
          <p>Acompanhe a operação e as vendas de {data.storeName}.</p>
        </div>
        <div
          className="dashboard-period"
          role="group"
          aria-label="Período do dashboard"
        >
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => handlePeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>
      <div className="sr-only" role="status">
        {busy ? "Atualizando indicadores…" : "Indicadores atualizados"}
      </div>
      {error && (
        <div role="alert" className="dashboard-error">
          <span>
            Não foi possível atualizar os dados. A última consulta continua
            visível.
          </span>
          <button type="button" onClick={() => void load(period)}>
            <RefreshCw aria-hidden="true" size={14} />
            Tentar novamente
          </button>
        </div>
      )}
      <section
        aria-label="Indicadores do período"
        aria-busy={busy}
        className="dashboard-metrics"
      >
        <Kpi
          label="Pedidos do período"
          value={String(data.kpis.pedidos)}
          loading={busy}
        />
        <Kpi
          label="Faturamento"
          value={money(data.kpis.faturamento)}
          loading={busy}
        />
        <Kpi
          label="Ticket médio"
          value={money(data.kpis.ticketMedio)}
          loading={busy}
        />
        <Kpi
          label="Pedidos em aberto"
          value={String(data.kpis.emAberto)}
          loading={busy}
          attention={data.kpis.emAberto > 0}
        />
      </section>
      <section
        className="dashboard-panel dashboard-orders"
        aria-labelledby="recent-orders-title"
      >
        <div className="dashboard-section-heading">
          <div>
            <h2 id="recent-orders-title">Pedidos recentes</h2>
            <p>Os últimos pedidos recebidos pela loja.</p>
          </div>
          <Link href="/admin/pedidos" className="dashboard-text-link">
            Ver todos <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        {recent.length ? (
          <div className="dashboard-table-scroll">
            <table className="dashboard-orders-table">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Horário</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link
                        className="dashboard-order-link"
                        href={`/admin/pedidos?pedido=${encodeURIComponent(o.id)}`}
                        aria-label={`Abrir pedido ${shortOrderId(o.id)} de ${o.cliente}`}
                      >
                        <span>#{shortOrderId(o.id)}</span>
                      </Link>
                    </td>
                    <td className="dashboard-customer">{o.cliente}</td>
                    <td className="dashboard-amount">{money(o.valor)}</td>
                    <td className="dashboard-order-time">
                      {time(o.createdAt)}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "dashboard-status",
                          statusClass(o.status),
                        )}
                      >
                        {statusLabel(o.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-empty">
            <p>Nenhum pedido por aqui ainda.</p>
            <span>Os novos pedidos aparecerão nesta lista.</span>
          </div>
        )}
      </section>
      <section
        aria-labelledby="performance-title"
        className="dashboard-performance"
      >
        <div className="dashboard-section-heading">
          <div>
            <h2 id="performance-title">Desempenho de vendas</h2>
            <p>Uma leitura do período selecionado.</p>
          </div>
        </div>
        <div className="dashboard-analytics-grid">
          <section
            className="dashboard-panel dashboard-sales"
            aria-label="Evolução das vendas"
          >
            <Tabs defaultValue="receita">
              <div className="dashboard-chart-heading">
                <h3>Evolução no período</h3>
                <TabsList
                  aria-label="Métrica do gráfico"
                  className="dashboard-tabs"
                >
                  <TabsTrigger value="receita">Receita</TabsTrigger>
                  <TabsTrigger value="volume">Pedidos</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="receita">
                {hasSales ? (
                  <div
                    className="dashboard-chart"
                    role="img"
                    aria-label={`Receita total no período: ${money(data.kpis.faturamento)}`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={data.salesByDay}
                        margin={{ top: 12, right: 14, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="#F4EAEE"
                          vertical={false}
                          strokeDasharray="3 4"
                        />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          minTickGap={28}
                          tick={{ fontSize: 11, fill: "#85808D" }}
                        />
                        <YAxis
                          width={44}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#85808D" }}
                          tickFormatter={(v) =>
                            new Intl.NumberFormat("pt-BR", {
                              notation: "compact",
                            }).format(v)
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #EFE5E9",
                            fontSize: 12,
                          }}
                          formatter={(v: number) => [money(v), "Receita"]}
                        />
                        <Line
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="receita"
                          stroke="#C8285F"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty message="Nenhuma venda neste período." />
                )}
              </TabsContent>
              <TabsContent value="volume">
                {data.hourly.some((h) => h.pedidos > 0) ? (
                  <div
                    className="dashboard-chart"
                    role="img"
                    aria-label="Quantidade de pedidos por horário"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.hourly}>
                        <CartesianGrid stroke="#F4EAEE" vertical={false} />
                        <XAxis
                          dataKey="hora"
                          axisLine={false}
                          tickLine={false}
                          minTickGap={25}
                          tick={{ fontSize: 11, fill: "#85808D" }}
                        />
                        <YAxis
                          width={30}
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#85808D" }}
                        />
                        <Tooltip />
                        <Bar
                          isAnimationActive={false}
                          dataKey="pedidos"
                          name="Pedidos"
                          fill="#8C70B4"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty message="Nenhum pedido por horário neste período." />
                )}
              </TabsContent>
            </Tabs>
          </section>
          <section
            className="dashboard-panel dashboard-breakdown"
            aria-label="Detalhes do desempenho"
          >
            <Tabs defaultValue="produtos">
              <TabsList
                aria-label="Detalhamento das vendas"
                className="dashboard-tabs dashboard-detail-tabs"
              >
                <TabsTrigger value="produtos">Produtos</TabsTrigger>
                <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
                <TabsTrigger value="atividade">Atividade</TabsTrigger>
              </TabsList>
              <TabsContent value="produtos">
                <h3 className="dashboard-list-title">Mais vendidos</h3>
                {data.topProducts.length ? (
                  <ol className="dashboard-ranking">
                    {data.topProducts.slice(0, 5).map((p, i) => (
                      <li key={`${p.nome}-${i}`}>
                        <span className="dashboard-rank">{i + 1}</span>
                        <span className="dashboard-product-name">{p.nome}</span>
                        <span className="dashboard-product-count">
                          {p.quantidade}
                          <small>vendidos</small>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Empty message="Os produtos mais vendidos aparecerão aqui." />
                )}
              </TabsContent>
              <TabsContent value="pagamentos">
                <h3 className="dashboard-list-title">Formas de pagamento</h3>
                {data.payments.length ? (
                  <ul className="dashboard-payments">
                    {data.payments.map((p) => (
                      <li key={p.name}>
                        <div>
                          <span>{p.name}</span>
                          <strong>{p.percentage}%</strong>
                        </div>
                        <div
                          className="dashboard-payment-track"
                          aria-hidden="true"
                        >
                          <span
                            style={{
                              width: `${Math.max(0, Math.min(100, p.percentage))}%`,
                            }}
                          />
                        </div>
                        <small>{money(p.value)}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty message="Sem pagamentos registrados no período." />
                )}
              </TabsContent>
              <TabsContent value="atividade">
                <h3 className="dashboard-list-title">Últimas atividades</h3>
                {recent.length ? (
                  <ul className="dashboard-activity">
                    {recent.slice(0, 4).map((o) => (
                      <li key={o.id}>
                        <span>
                          #{shortOrderId(o.id)}{" "}
                          <small>{statusLabel(o.status)}</small>
                        </span>
                        <time dateTime={o.createdAt}>{time(o.createdAt)}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty message="Nenhuma atividade recente." />
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </section>
    </div>
  );
}
function Kpi({
  label,
  value,
  loading,
  attention = false,
}: {
  label: string;
  value: string;
  loading: boolean;
  attention?: boolean;
}) {
  return (
    <div
      className={cn(
        "dashboard-metric",
        attention && "dashboard-metric-attention",
      )}
    >
      <p>{label}</p>
      {loading ? (
        <div className="dashboard-metric-loading" />
      ) : (
        <strong>{value}</strong>
      )}
      {attention && (
        <Link href="/admin/pedidos" className="dashboard-metric-action">
          Acompanhar pedidos <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
function Empty({ message }: { message: string }) {
  return (
    <div className="dashboard-empty">
      <p>{message}</p>
      <span>Experimente outro período para consultar o histórico.</span>
    </div>
  );
}
