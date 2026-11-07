"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Truck,
  Printer,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  FileText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

type OrderDetailsModalProps = {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (orderId: string, newStatus: string) => void;
  onPrint: (order: Order) => void;
};

const statusConfig = {
  pendente: {
    label: "Pendente",
    icon: Clock,
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
  },
  confirmado: {
    label: "Confirmado",
    icon: CheckCircle,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  preparando: {
    label: "Preparando",
    icon: Package,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  saiu_entrega: {
    label: "Saiu para Entrega",
    icon: Truck,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  entregue: {
    label: "Entregue",
    icon: CheckCircle,
    color: "text-green-600 bg-green-50 border-green-200",
  },
  cancelado: {
    label: "Cancelado",
    icon: XCircle,
    color: "text-red-600 bg-red-50 border-red-200",
  },
};

export function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  onStatusChange,
  onPrint,
}: OrderDetailsModalProps) {
  if (!order) return null;

  const statusInfo =
    statusConfig[order.status as keyof typeof statusConfig] ||
    statusConfig.pendente;
  const StatusIcon = statusInfo.icon;

  const handleStatusChange = (newStatus: string) => {
    onStatusChange(order.id, newStatus);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes do Pedido #{order.id.slice(0, 8)}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPrint(order)}
              className="ml-4"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogTitle>
          <DialogDescription>
            Pedido realizado em{" "}
            {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Status e Ações */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Status do Pedido
                </label>
                <Select value={order.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-6">
                <Badge
                  className={`${statusInfo.color} border px-4 py-2 text-sm`}
                >
                  <StatusIcon className="h-4 w-4 mr-2" />
                  {statusInfo.label}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Informações do Cliente */}
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-500" />
                Informações do Cliente
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-white rounded-full p-2">
                    <Mail className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nome</p>
                    <p className="font-medium text-gray-900">
                      {order.cliente_nome}
                    </p>
                  </div>
                </div>
                {order.cliente_email && (
                  <div className="flex items-start gap-3">
                    <div className="bg-white rounded-full p-2">
                      <Mail className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">
                        {order.cliente_email}
                      </p>
                    </div>
                  </div>
                )}
                {order.cliente_telefone && (
                  <div className="flex items-start gap-3">
                    <div className="bg-white rounded-full p-2">
                      <Phone className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Telefone
                      </p>
                      <p className="font-medium text-gray-900">
                        {order.cliente_telefone}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Endereço de Entrega */}
            {order.endereco_entrega && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-500" />
                    Endereço de Entrega
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {typeof order.endereco_entrega === "string" ? (
                      <p className="font-medium text-gray-900">
                        {order.endereco_entrega}
                      </p>
                    ) : (
                      <>
                        <p className="font-medium text-gray-900">
                          {String(
                            order.endereco_entrega.rua ||
                              order.endereco_entrega.logradouro ||
                              ""
                          )}
                          {order.endereco_entrega.numero
                            ? `, ${String(order.endereco_entrega.numero)}`
                            : ""}
                        </p>
                        {order.endereco_entrega.complemento ? (
                          <p className="text-gray-600 mt-1">
                            {String(order.endereco_entrega.complemento)}
                          </p>
                        ) : null}
                        <p className="text-gray-600 mt-1">
                          {String(order.endereco_entrega.bairro || "")}
                        </p>
                        <p className="text-gray-600 mt-1">
                          {String(order.endereco_entrega.cidade || "")}
                          {order.endereco_entrega.estado
                            ? `, ${String(order.endereco_entrega.estado)}`
                            : ""}
                        </p>
                        {order.endereco_entrega.cep ? (
                          <p className="text-gray-600 mt-1">
                            CEP: {String(order.endereco_entrega.cep)}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Itens do Pedido */}
            <Separator />
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-500" />
                Itens do Pedido
              </h3>
              <div className="space-y-3">
                {order.itens.map((item, index) => {
                  const nome = String(
                    item.nome ||
                      (item.produto as { name?: string } | undefined)?.name ||
                      "Item"
                  );
                  const observacoes =
                    typeof item.observacoes === "string"
                      ? item.observacoes
                      : null;
                  const quantidade = Number(item.quantidade ?? item.qty ?? 1);
                  const preco = Number(item.preco ?? item.price ?? 0);
                  return (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{nome}</p>
                      {observacoes && (
                        <p className="text-sm text-gray-500 mt-1">
                          Obs: {observacoes}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mt-1">
                        Quantidade: {quantidade} x R${" "}
                        {preco.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        R${" "}
                        {(quantidade * preco)
                          .toFixed(2)
                          .replace(".", ",")}
                      </p>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Observações */}
            {order.observacoes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-500" />
                    Observações
                  </h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-gray-900">{order.observacoes}</p>
                  </div>
                </div>
              </>
            )}

            {/* Resumo do Pagamento */}
            <Separator />
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-500" />
                Pagamento
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Método de Pagamento:</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {order.metodo_pagamento}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">
                    Total:
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    R$ {order.total.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
