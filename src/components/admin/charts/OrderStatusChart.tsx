"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PieChartIcon } from "lucide-react";

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface OrderStatusChartProps {
  data: StatusData[];
  title?: string;
  description?: string;
}

export function OrderStatusChart({ data, title, description }: OrderStatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {title || "Status dos Pedidos"}
          </h3>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-pink-50">
          <PieChartIcon className="w-5 h-5 text-pink-600" />
        </div>
      </div>

      <div className="h-80 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}
            </Pie>
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
              formatter={(value: number, name: string) => [
                `${value} pedidos (${((value / total) * 100).toFixed(1)}%)`,
                name
              ]}
            />
            <Legend
              verticalAlign="bottom"
              height={56}
              iconType="circle"
              iconSize={10}
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <p className="text-3xl font-bold text-gray-900">{total}</p>
          <p className="text-sm text-gray-600 mt-1">Total</p>
        </div>
      </div>
    </div>
  );
}

