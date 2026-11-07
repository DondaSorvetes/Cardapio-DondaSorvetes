"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface HourlyData {
  hora: string;
  pedidos: number;
}

interface PremiumHourlyChartProps {
  title?: string;
  description?: string;
  data?: HourlyData[];
}

export function PremiumHourlyChart({
  title = "Pedidos por Horário",
  description = "Volume de pedidos ao longo do dia",
  data = [],
}: PremiumHourlyChartProps) {

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
        <p className="text-sm text-[#6B7280] mt-1">{description}</p>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E5E7EB"
              vertical={false}
            />
            <XAxis
              dataKey="hora"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6B7280", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6B7280", fontSize: 12 }}
              dx={-10}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              labelStyle={{
                color: "#111827",
                fontWeight: 600,
                marginBottom: "4px",
              }}
              formatter={(value: number) => [`${value} pedidos`, "Volume"]}
              cursor={{ fill: "#F7F8FC" }}
            />
            <Bar
              dataKey="pedidos"
              fill="#E33E70"
              radius={[8, 8, 0, 0]}
              animationDuration={1000}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
