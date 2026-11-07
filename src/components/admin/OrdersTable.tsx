"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MoreVertical,
  Search,
  Filter,
  Eye,
  Printer,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Truck,
} from "lucide-react";
import { OrderDetailsModal } from "./OrderDetailsModal";

type Order = {
  id: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string;
  endereco_entrega: string | Record<string, unknown> | null;
  itens: Array<Record<string, unknown>>;
  total: number;
  status: string;
  metodo_pagamento: string;
  created_at: string;
  observacoes?: string;
};

type OrdersTableProps = {
  initialOrders: Order[];
};

const statusConfig = {
  pendente: {
    label: "Pendente",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
  },
  confirmado: {
    label: "Confirmado",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  preparando: {
    label: "Preparando",
    variant: "default" as const,
    icon: Package,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  saiu_entrega: {
    label: "Saiu para Entrega",
    variant: "default" as const,
    icon: Truck,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  entregue: {
    label: "Entregue",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-green-600 bg-green-50 border-green-200",
  },
  cancelado: {
    label: "Cancelado",
    variant: "destructive" as const,
    icon: XCircle,
    color: "text-red-600 bg-red-50 border-red-200",
  },
};

export function OrdersTable({ initialOrders }: OrdersTableProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.cliente_telefone?.includes(searchTerm);

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handlePrint = (order: Order) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pendente;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido #${order.id.slice(0, 8)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 24px; margin-bottom: 20px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; }
            .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sorvetes Donda</h1>
            <p><strong>Pedido:</strong> #${order.id.slice(0, 8)}</p>
            <p><strong>Data:</strong> ${format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            <p><strong>Status:</strong> <span class="status-badge">${statusInfo.label}</span></p>
          </div>

          <div class="section">
            <div class="section-title">Informações do Cliente</div>
            <p><strong>Nome:</strong> ${order.cliente_nome}</p>
            <p><strong>Email:</strong> ${order.cliente_email || 'Não informado'}</p>
            <p><strong>Telefone:</strong> ${order.cliente_telefone || 'Não informado'}</p>
          </div>

          ${order.endereco_entrega ? `
            <div class="section">
              <div class="section-title">Endereço de Entrega</div>
              <p>${
                typeof order.endereco_entrega === "string"
                  ? order.endereco_entrega
                  : [
                      order.endereco_entrega.rua || order.endereco_entrega.logradouro || "",
                      order.endereco_entrega.numero || "",
                    ]
                      .filter(Boolean)
                      .join(", ")
              }</p>
              ${
                typeof order.endereco_entrega !== "string" && order.endereco_entrega.complemento
                  ? `<p>${String(order.endereco_entrega.complemento)}</p>`
                  : ""
              }
              ${
                typeof order.endereco_entrega !== "string"
                  ? `<p>${String(order.endereco_entrega.bairro || "")} - ${String(order.endereco_entrega.cidade || "")}, ${String(order.endereco_entrega.estado || "")}</p>
                     <p>CEP: ${String(order.endereco_entrega.cep || "")}</p>`
                  : ""
              }
            </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Itens do Pedido</div>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Preço Unitário</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${order.itens.map((item) => {
                  const nome = String(item.nome || "Item");
                  const qtd = Number(item.quantidade ?? item.qty ?? 1);
                  const preco = Number(item.preco ?? item.price ?? 0);
                  return `
                  <tr>
                    <td>${nome}</td>
                    <td>${qtd}</td>
                    <td>R$ ${preco.toFixed(2).replace('.', ',')}</td>
                    <td>R$ ${(qtd * preco).toFixed(2).replace('.', ',')}</td>
                  </tr>
                `;
                }).join('')}
              </tbody>
            </table>
          </div>

          ${order.observacoes ? `
            <div class="section">
              <div class="section-title">Observações</div>
              <p>${order.observacoes}</p>
            </div>
          ` : ''}

          <div class="total">
            Total: R$ ${order.total.toFixed(2).replace('.', ',')}
          </div>

          <div class="section" style="margin-top: 40px; border-top: 2px solid #000; padding-top: 20px;">
            <p><strong>Método de Pagamento:</strong> ${order.metodo_pagamento}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch("/api/pedidos/atualizar-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      if (response.ok) {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );
        
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nome, ID ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="preparando">Preparando</SelectItem>
              <SelectItem value="saiu_entrega">Saiu para Entrega</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resumo de Status */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(statusConfig).map(([key, config]) => {
            const count = orders.filter((o) => o.status === key).length;
            const Icon = config.icon;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}
                className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                  statusFilter === key
                    ? config.color
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{config.label}</span>
                </div>
                <p className="text-xl font-bold">{count}</p>
              </button>
            );
          })}
        </div>

        {/* Tabela de Pedidos */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Pedido</TableHead>
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Data/Hora</TableHead>
                <TableHead className="font-semibold">Itens</TableHead>
                <TableHead className="font-semibold">Total</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pendente;
                const StatusIcon = statusInfo.icon;
                
                return (
                  <TableRow
                    key={order.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleViewDetails(order)}
                  >
                    <TableCell>
                      <div className="font-mono text-sm font-medium">
                        #{order.id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">
                          {order.cliente_nome}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.cliente_telefone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {format(new Date(order.created_at), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </div>
                        <div className="text-gray-500">
                          {format(new Date(order.created_at), "HH:mm", {
                            locale: ptBR,
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-gray-900">
                        {order.itens.length} {order.itens.length === 1 ? "item" : "itens"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-gray-900">
                        R$ {order.total.toFixed(2).replace(".", ",")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusInfo.variant}
                        className={`${statusInfo.color} border flex items-center gap-1 w-fit`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(order);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrint(order);
                            }}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir Pedido
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
                          {Object.entries(statusConfig).map(([key, config]) => {
                            const Icon = config.icon;
                            return (
                              <DropdownMenuItem
                                key={key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(order.id, key);
                                }}
                                disabled={order.status === key}
                              >
                                <Icon className="mr-2 h-4 w-4" />
                                {config.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-gray-500"
                  >
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium">Nenhum pedido encontrado</p>
                    <p className="text-sm mt-1">
                      Tente ajustar os filtros ou a busca
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Informação de resultados */}
        <div className="text-sm text-gray-500 text-center">
          Mostrando {filteredOrders.length} de {orders.length} pedidos
        </div>
      </div>

      {/* Modal de Detalhes */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
        onStatusChange={handleStatusChange}
        onPrint={handlePrint}
      />
    </>
  );
}
