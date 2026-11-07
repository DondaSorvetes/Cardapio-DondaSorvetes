import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react";

interface FinancialSummaryProps {
  data: {
    revenue: {
      total: number;
      today: number;
    };
    orders: {
      total: number;
    };
    avgTicket: number;
  };
}

export function FinancialSummary({ data }: FinancialSummaryProps) {
  // Simulação de dados financeiros (você pode ajustar com dados reais)
  const receita = data.revenue.total;
  const despesas = receita * 0.35; // 35% de custos
  const lucro = receita - despesas;
  const margem = (lucro / receita) * 100;

  const items = [
    {
      label: "Receita",
      value: receita,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      icon: DollarSign,
    },
    {
      label: "Despesas",
      value: despesas,
      color: "text-red-600",
      bgColor: "bg-red-50",
      icon: TrendingDown,
    },
    {
      label: "Lucro",
      value: lucro,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      icon: TrendingUp,
    },
    {
      label: "Margem",
      value: margem,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      icon: Percent,
      isPercent: true,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 h-full">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Resumo Financeiro</h3>
        <p className="text-sm text-gray-600 mt-1">Visão consolidada do mês</p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="group flex items-center justify-between p-4 rounded-xl hover:bg-gray-50/80 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-lg ${item.bgColor} group-hover:scale-110 transition-transform duration-200`}
                >
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {item.label}
                </span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {item.isPercent
                  ? `${item.value.toFixed(1)}%`
                  : `R$ ${item.value.toFixed(2).replace(".", ",")}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-6 pt-6 border-t border-gray-200/60">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Meta do Mês</span>
          <span className="font-semibold text-gray-900">
            {((receita / (receita * 1.2)) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C8285F] to-[#6b3cb0] rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.min((receita / (receita * 1.2)) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
