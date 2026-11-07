"use client";

import { Search, Filter, Download, RefreshCw, ShoppingBag, Clock, CheckCircle2, XCircle, Plus } from "lucide-react";
import { useState } from "react";
import {
  PremiumPageHeader,
  PremiumFilterBar,
  PremiumOrdersTable,
  PremiumStatCard,
  PremiumEmptyState,
} from "@/components/admin/premium";

interface Order {
  id: string;
  cliente_nome?: string;
  endereco?: string;
  metodo_pagamento?: string;
  status_pagamento: string;
  created_at: string;
  total: number;
}

interface PedidosPageContentProps {
  pedidosIniciais: Order[];
}

export function PedidosPageContent({ pedidosIniciais }: PedidosPageContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Converter dados do Supabase para o formato esperado
  const orders = pedidosIniciais.map((order) => ({
    id: order.id,
    cliente: order.cliente_nome || "Cliente",
    endereco: order.endereco || "Endereço não informado",
    pagamento: order.metodo_pagamento || "Não informado",
    status: (order.status_pagamento || "pendente") as "pago" | "pendente" | "cancelado",
    tempo: new Date(order.created_at),
    valor: order.total,
  }));

  const filteredOrders = orders.filter((order) =>
    order.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.id.includes(searchQuery)
  );

  const stats = {
    total: orders.length,
    pendentes: orders.filter((o) => o.status === "pendente").length,
    concluidos: orders.filter((o) => o.status === "pago").length,
    cancelados: orders.filter((o) => o.status === "cancelado").length,
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <PremiumPageHeader
        title="Pedidos"
        description="Gerencie todos os pedidos do sistema em tempo real"
        icon={ShoppingBag}
        action={
          <button className="h-11 px-6 bg-[#C8285F] hover:bg-[#E33E70] text-white font-medium rounded-xl flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md">
            <Plus className="w-5 h-5" />
            <span>Novo Pedido</span>
          </button>
        }
        breadcrumb={[
          { label: "Dashboard", href: "/admin" },
          { label: "Pedidos" },
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <PremiumStatCard
          title="Total de Pedidos"
          value={stats.total}
          icon="ShoppingBag"
          variant="purple"
          subtitle="Todos os pedidos"
        />
        <PremiumStatCard
          title="Pendentes"
          value={stats.pendentes}
          icon="Target"
          variant="orange"
          subtitle="Aguardando processamento"
        />
        <PremiumStatCard
          title="Concluídos"
          value={stats.concluidos}
          icon="Target"
          variant="green"
          subtitle="Pagos e entregues"
        />
        <PremiumStatCard
          title="Cancelados"
          value={stats.cancelados}
          icon="Target"
          variant="pink"
          subtitle="Pedidos cancelados"
        />
      </div>

      {/* Filters */}
      <PremiumFilterBar
        searchPlaceholder="Buscar por pedido ou cliente..."
        onSearch={setSearchQuery}
        onFilter={() => console.log("Filter")}
        onExport={() => console.log("Export")}
        onRefresh={() => window.location.reload()}
      />

      {/* Orders Table */}
      {filteredOrders.length > 0 ? (
        <PremiumOrdersTable orders={filteredOrders} showAll />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB]">
          <PremiumEmptyState
            icon={ShoppingBag}
            title="Nenhum pedido encontrado"
            description="Não encontramos pedidos com os critérios de busca informados. Tente ajustar os filtros."
            variant="purple"
          />
        </div>
      )}
    </div>
  );
}
