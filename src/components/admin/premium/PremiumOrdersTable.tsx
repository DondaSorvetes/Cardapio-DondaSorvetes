"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreHorizontal, Eye, Download, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  cliente: string;
  endereco: string;
  pagamento: string;
  status: string;
  tempo: Date;
  valor: number;
}

interface PremiumOrdersTableProps {
  orders: Order[];
  title?: string;
  showAll?: boolean;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  preparando: {
    label: "Preparando",
    className: "bg-pink-50 text-pink-700 border-pink-200",
  },
  saiu_para_entrega: {
    label: "Saiu para entrega",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  entregue: {
    label: "Entregue",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  pago: {
    label: "Pago",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export function PremiumOrdersTable({
  orders,
  title = "Pedidos Recentes",
  showAll = false,
}: PremiumOrdersTableProps) {
  const displayOrders = showAll ? orders : orders.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition-all duration-200">
      <div className="p-6 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
            <p className="text-sm text-[#6B7280] mt-1">
              {displayOrders.length} pedidos
            </p>
          </div>
          {!showAll && (
            <button className="text-sm font-medium text-[#C8285F] hover:text-[#E33E70] transition-colors">
              Ver todos
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E7EB]">
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Pedido
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">
                Endereço
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden lg:table-cell">
                Pagamento
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden xl:table-cell">
                Tempo
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Valor
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {displayOrders.map((order) => (
              <tr
                key={order.id}
                className="hover:bg-[#F7F8FC] transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-[#111827]">
                    #{order.id.slice(0, 8)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-[#111827]">
                    {order.cliente}
                  </span>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  <span className="text-sm text-[#6B7280] line-clamp-1 max-w-[200px]">
                    {order.endereco}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                  <span className="text-sm text-[#6B7280]">
                    {order.pagamento}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border",
                      statusConfig[order.status]?.className || "bg-gray-50 text-gray-700 border-gray-200"
                    )}
                  >
                    {(order.status === "pago" || order.status === "entregue") && (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    {statusConfig[order.status]?.label || order.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                  <span className="text-sm text-[#6B7280]">
                    {format(order.tempo, "HH:mm", { locale: ptBR })}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-semibold text-[#111827]">
                    R$ {order.valor.toFixed(2).replace(".", ",")}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-2 hover:bg-[#FDE6EE] rounded-lg transition-colors group">
                      <Eye className="w-4 h-4 text-[#6B7280] group-hover:text-[#C8285F]" />
                    </button>
                    <button className="p-2 hover:bg-[#FDE6EE] rounded-lg transition-colors group">
                      <Download className="w-4 h-4 text-[#6B7280] group-hover:text-[#C8285F]" />
                    </button>
                    <button className="p-2 hover:bg-[#FDE6EE] rounded-lg transition-colors group">
                      <MoreHorizontal className="w-4 h-4 text-[#6B7280] group-hover:text-[#C8285F]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
