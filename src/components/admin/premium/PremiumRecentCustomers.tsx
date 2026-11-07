"use client";

import { Users, TrendingUp, UserPlus, Repeat } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  nome: string;
  email: string;
  totalPedidos: number;
  totalGasto: number;
  ultimoPedido: Date;
  tipo: "novo" | "recorrente" | "vip";
}

interface PremiumRecentCustomersProps {
  title?: string;
  customers?: Customer[];
}

const tipoConfig = {
  novo: {
    label: "Novo",
    icon: UserPlus,
    className: "bg-blue-50 text-blue-700",
  },
  recorrente: {
    label: "Recorrente",
    icon: Repeat,
    className: "bg-[#FDE6EE] text-[#C8285F]",
  },
  vip: {
    label: "VIP",
    icon: TrendingUp,
    className: "bg-amber-50 text-amber-700",
  },
};

export function PremiumRecentCustomers({
  title = "Clientes Recentes",
  customers = [],
}: PremiumRecentCustomersProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition-all duration-200">
      <div className="p-6 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
            <p className="text-sm text-[#6B7280] mt-1">
              Últimos {customers.length} clientes ativos
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FDE6EE] flex items-center justify-center">
            <Users className="w-5 h-5 text-[#C8285F]" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {customers.map((customer) => {
          const config = tipoConfig[customer.tipo];
          const Icon = config.icon;

          return (
            <div
              key={customer.id}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-[#F7F8FC] transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C8285F] to-[#E33E70] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <span className="text-white font-semibold text-sm">
                  {customer.nome
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-[#111827] truncate">
                    {customer.nome}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                      config.className
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] truncate">
                  {customer.email}
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Último pedido:{" "}
                  {format(customer.ultimoPedido, "HH:mm", { locale: ptBR })}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-[#111827]">
                  R$ {customer.totalGasto.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {customer.totalPedidos}{" "}
                  {customer.totalPedidos === 1 ? "pedido" : "pedidos"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 border-t border-[#E5E7EB]">
        <button className="w-full text-sm font-medium text-[#C8285F] hover:text-[#E33E70] transition-colors">
          Ver todos os clientes
        </button>
      </div>
    </div>
  );
}
