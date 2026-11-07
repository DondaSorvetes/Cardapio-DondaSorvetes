"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface PremiumDonutChartProps {
  data: ChartData[];
  title?: string;
  description?: string;
}

export function PremiumDonutChart({
  data,
  title = "Distribuição",
  description,
}: PremiumDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
        {description && (
          <p className="text-sm text-[#6B7280] mt-1">{description}</p>
        )}
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Chart */}
        <div className="w-full lg:w-1/2 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                animationDuration={1000}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  padding: "12px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
                formatter={(value: number) => [
                  `${value} (${((value / total) * 100).toFixed(1)}%)`,
                  "",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="w-full lg:w-1/2 space-y-3">
          {data.map((item, index) => {
            const percentage = ((item.value / total) * 100).toFixed(1);
            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F7F8FC] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-[#111827]">
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#111827]">
                    {item.value}
                  </p>
                  <p className="text-xs text-[#6B7280]">{percentage}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
