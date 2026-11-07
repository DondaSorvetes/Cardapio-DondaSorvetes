"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ExternalLink } from "lucide-react";

// Mock data - substitua pelos dados reais do seu banco
const mockOrders = [
  {
    id: "#12345",
    customer: "João Silva",
    amount: 89.90,
    payment: "PIX",
    status: "paid",
    date: "Há 5 min",
  },
  {
    id: "#12344",
    customer: "Maria Santos",
    amount: 125.50,
    payment: "Cartão",
    status: "pending",
    date: "Há 12 min",
  },
  {
    id: "#12343",
    customer: "Carlos Oliveira",
    amount: 45.00,
    payment: "Dinheiro",
    status: "paid",
    date: "Há 1h",
  },
  {
    id: "#12342",
    customer: "Ana Costa",
    amount: 67.80,
    payment: "PIX",
    status: "paid",
    date: "Há 2h",
  },
  {
    id: "#12341",
    customer: "Pedro Alves",
    amount: 198.00,
    payment: "Cartão",
    status: "cancelled",
    date: "Há 3h",
  },
];

const statusConfig = {
  paid: { label: "Pago", variant: "default" as const, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "Pendente", variant: "secondary" as const, color: "bg-amber-50 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelado", variant: "destructive" as const, color: "bg-red-50 text-red-700 border-red-200" },
};

export function LatestOrdersTable() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200/60">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Últimos Pedidos</h3>
            <p className="text-sm text-gray-600 mt-1">Pedidos recentes da plataforma</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#C8285F] hover:text-[#3d1e70] hover:bg-pink-50"
          >
            Ver todos
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200/60 bg-gray-50/50">
              <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Pedido
              </th>
              <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Cliente
              </th>
              <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Valor
              </th>
              <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Pagamento
              </th>
              <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Data
              </th>
              <th className="text-right py-3.5 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200/60">
            {mockOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
              return (
                <tr
                  key={order.id}
                  className="group hover:bg-gray-50/50 transition-colors duration-150"
                >
                  <td className="py-4 px-6">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {order.id}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-medium text-gray-900">
                      {order.customer}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-bold text-gray-900">
                      R$ {order.amount.toFixed(2).replace(".", ",")}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                      {order.payment}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <Badge
                      variant={statusInfo.variant}
                      className={`${statusInfo.color} border font-medium`}
                    >
                      {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-600">{order.date}</span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
