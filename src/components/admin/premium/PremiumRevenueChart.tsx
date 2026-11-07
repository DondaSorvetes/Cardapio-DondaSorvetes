"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PremiumRevenueChartProps {
  data: Array<{
    name: string;
    receita: number;
  }>;
  title?: string;
  description?: string;
}

export function PremiumRevenueChart({
  data,
  title = "Evolução da Receita",
  description = "Receita mensal",
}: PremiumRevenueChartProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
        <p className="text-sm text-[#6B7280] mt-1">{description}</p>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E33E70" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#E33E70" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E5E7EB"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6B7280", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6B7280", fontSize: 12 }}
              tickFormatter={(value) =>
                `R$ ${(value / 1000).toFixed(0)}k`
              }
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
              formatter={(value: number) => [
                `R$ ${value.toFixed(2).replace(".", ",")}`,
                "Receita",
              ]}
            />
            <Area
              type="monotone"
              dataKey="receita"
              stroke="#E33E70"
              strokeWidth={3}
              fill="url(#colorReceita)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
