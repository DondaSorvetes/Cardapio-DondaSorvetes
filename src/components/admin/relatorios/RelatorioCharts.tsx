"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NomeValor, SerieDia, SerieHora } from "@/types/relatorios";
import { reportMoney, reportNumber } from "@/lib/relatorios/presentation";

const PURPLE = "#C8285F";
const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #E7E3EA",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "none",
};
export function ReportPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`report-panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function ReportEmpty({
  children = "Sem registros neste período.",
}: {
  children?: React.ReactNode;
}) {
  return <p className="report-empty">{children}</p>;
}
export function ChartFaturamento({ data }: { data: SerieDia[] }) {
  const available = data.some((row) => Number.isFinite(row.faturamento));
  const sales = data.filter((row) => row.faturamento > 0).length;
  return (
    <ReportPanel title="Evolução das vendas" className="report-sales">
      {!available ? (
        <ReportEmpty />
      ) : sales === 0 ? (
        <ReportEmpty>
          Nenhuma venda registrada no período. Faturamento: {reportMoney(0)}.
        </ReportEmpty>
      ) : (
        <>
          <div
            className={`report-chart ${sales < 3 ? "report-chart-small" : ""}`}
            role="img"
            aria-label={`Evolução diária de vendas. ${sales} dias com faturamento.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id="report-sales-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PURPLE} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F4EAEE" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#776670", fontSize: 11 }}
                  minTickGap={32}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, "auto"]}
                  width={64}
                  tick={{ fill: "#776670", fontSize: 10 }}
                  tickFormatter={(value) =>
                    `R$ ${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [
                    reportMoney(value),
                    "Faturamento",
                  ]}
                />
                <Area
                  type="linear"
                  dataKey="faturamento"
                  stroke={PURPLE}
                  strokeWidth={2}
                  fill="url(#report-sales-fill)"
                  dot={data.length <= 7 ? { r: 3, fill: PURPLE } : false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="report-chart-data">
            <summary>Consultar valores por dia</summary>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Pedidos</th>
                    <th>Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.date}>
                      <td>{row.label}</td>
                      <td>{reportNumber(row.pedidos)}</td>
                      <td>
                        {Number.isFinite(row.faturamento)
                          ? reportMoney(row.faturamento)
                          : "Sem informação"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </ReportPanel>
  );
}
export function ChartHoras({ data }: { data: SerieHora[] }) {
  const has = data.some((row) => row.pedidos > 0);
  return (
    <ReportPanel title="Pedidos por horário">
      {!has ? (
        <ReportEmpty />
      ) : (
        <>
          <div
            className="report-chart report-chart-small"
            role="img"
            aria-label="Quantidade de pedidos por horário"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid stroke="#F4EAEE" vertical={false} />
                <XAxis
                  dataKey="hora"
                  minTickGap={24}
                  tick={{ fill: "#776670", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={28}
                  allowDecimals={false}
                  tick={{ fill: "#776670", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [
                    reportNumber(value),
                    "Pedidos",
                  ]}
                />
                <Bar
                  dataKey="pedidos"
                  fill={PURPLE}
                  maxBarSize={24}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="report-chart-data">
            <summary>Consultar valores por horário</summary>
            <ul className="report-value-list">
              {data.map((row) => (
                <li key={row.hora}>
                  <span>{row.hora}</span>
                  <strong>{reportNumber(row.pedidos)} pedidos</strong>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </ReportPanel>
  );
}
function Distribution({
  title,
  data,
  kind = "default",
  note,
}: {
  title: string;
  data: NomeValor[];
  kind?: "default" | "status";
  note?: string;
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return (
    <ReportPanel title={title}>
      {note && <p className="report-panel-note">{note}</p>}
      {!data.length ? (
        <ReportEmpty />
      ) : total === 0 ? (
        <ReportEmpty>Nenhum pedido no período.</ReportEmpty>
      ) : (
        <ul className="report-distribution">
          {data.map((row, index) => {
            const percent = total > 0 ? (row.value / total) * 100 : 0;
            const color =
              kind === "status" && /cancel/i.test(row.name)
                ? "#B42332"
                : kind === "status" && /final|entregue|conclu/i.test(row.name)
                  ? "#23815B"
                  : ["#C8285F", "#8C70AE", "#B5A3CA", "#776670"][index % 4];
            return (
              <li key={row.name}>
                <div>
                  <span>{row.name}</span>
                  <strong>
                    {reportNumber(row.value)}{" "}
                    <small>{reportNumber(percent, 1)}%</small>
                  </strong>
                </div>
                <div className="report-bar" aria-hidden="true">
                  <span
                    style={{ width: `${percent}%`, backgroundColor: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ReportPanel>
  );
}
export function ChartPizza({ data }: { data: NomeValor[] }) {
  return (
    <Distribution
      title="Formas de pagamento"
      data={data}
    />
  );
}
export function ChartPedidosBar({ data }: { data: NomeValor[] }) {
  return <Distribution title="Pedidos por status" data={data} kind="status" />;
}
export function ChartCategorias({ data }: { data: NomeValor[] }) {
  return <Distribution title="Canais e tipos de pedido" data={data} />;
}
export function ChartMensal() {
  return null;
}
export function ChartSemana() {
  return null;
}
