"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface RevenueData {
  label?: string;
  month?: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  title: string;
  description?: string;
}

export function RevenueLineChart({ data, title, description }: RevenueChartProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-blue-50">
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="colorRevenueLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C8285F" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#C8285F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#f3f4f6" 
              vertical={false}
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey={(entry) => entry.label || entry.month || ""}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13, fill: "#6b7280", fontWeight: 500 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13, fill: "#6b7280", fontWeight: 500 }}
              tickFormatter={(value) => `R$ ${value}`}
              dx={-5}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                border: "none",
                borderRadius: "12px",
                boxShadow: "0 10px 40px -10px rgba(0, 0, 0, 0.2)",
                padding: "12px 16px",
              }}
              labelStyle={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: "#111827",
                marginBottom: 4 
              }}
              formatter={(value: number) => [
                `R$ ${value.toFixed(2).replace(".", ",")}`,
                "Receita"
              ]}
              cursor={{ stroke: "#C8285F", strokeWidth: 1, strokeDasharray: "5 5" }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#C8285F"
              strokeWidth={3}
              dot={{
                r: 5,
                fill: "#fff",
                stroke: "#C8285F",
                strokeWidth: 3,
              }}
              activeDot={{
                r: 7,
                fill: "#C8285F",
                stroke: "#fff",
                strokeWidth: 3,
              }}
              fill="url(#colorRevenueLine)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RevenueAreaChart({ data, title, description }: RevenueChartProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="colorRevenueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#f3f4f6" 
              vertical={false}
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey={(entry) => entry.label || entry.month || ""}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13, fill: "#6b7280", fontWeight: 500 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13, fill: "#6b7280", fontWeight: 500 }}
              tickFormatter={(value) => `R$ ${value}`}
              dx={-5}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                border: "none",
                borderRadius: "12px",
                boxShadow: "0 10px 40px -10px rgba(0, 0, 0, 0.2)",
                padding: "12px 16px",
              }}
              labelStyle={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: "#111827",
                marginBottom: 4 
              }}
              formatter={(value: number) => [
                `R$ ${value.toFixed(2).replace(".", ",")}`,
                "Receita"
              ]}
              cursor={{ stroke: "#10b981", strokeWidth: 2, strokeDasharray: "5 5" }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              strokeWidth={3}
              fill="url(#colorRevenueArea)"
              dot={{
                r: 4,
                fill: "#fff",
                stroke: "#10b981",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: "#10b981",
                stroke: "#fff",
                strokeWidth: 3,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

