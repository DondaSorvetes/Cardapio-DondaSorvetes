"use client";

import { Cliente, clienteStatusConfig } from "@/types/cliente";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  ShoppingBag,
  TrendingUp,
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface ClienteSidePanelProps {
  cliente: Cliente;
}

export function ClienteSidePanel({ cliente }: ClienteSidePanelProps) {
  const statusInfo = cliente.status_cliente
    ? clienteStatusConfig[cliente.status_cliente]
    : null;

  const enderecoPrincipal = cliente.enderecos_adicionais?.find((e) => e.principal);

  return (
    <div className="w-full 2xl:w-[280px] 2xl:h-full bg-white border-l border-[#E5E7EB] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E7EB]">
        <h3 className="font-semibold text-[#111827] text-sm">Resumo Rápido</h3>
      </div>

      {/* Content */}
      <div className="flex-1 2xl:overflow-y-auto p-4 space-y-5">
        {/* Status */}
        {statusInfo && (
          <section>
            <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">
              Status
            </h4>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border",
                statusInfo.color
              )}
            >
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{statusInfo.label}</span>
            </div>
          </section>
        )}

        <Separator />

        {/* Estatísticas Rápidas */}
        <section>
          <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">
            Estatísticas
          </h4>
          <div className="space-y-3">
            {/* Total de Pedidos */}
            <div className="flex items-start gap-2">
              <ShoppingBag className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">Total de Pedidos</p>
                <p className="text-lg font-bold text-[#111827]">
                  {cliente.total_pedidos || 0}
                </p>
              </div>
            </div>

            {/* Total Gasto */}
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">Total Gasto</p>
                <p className="text-lg font-bold text-[#C8285F]">
                  R$ {(cliente.total_gasto || 0).toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>

            {/* Ticket Médio */}
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">Ticket Médio</p>
                <p className="text-sm font-semibold text-[#111827]">
                  R$ {(cliente.ticket_medio || 0).toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Endereço Principal */}
        {enderecoPrincipal && (
          <>
            <section>
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">
                Endereço Principal
              </h4>
              <div className="bg-[#F8F9FC] rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-[#C8285F] mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-medium text-[#111827]">
                    {enderecoPrincipal.apelido || "Endereço"}
                  </p>
                </div>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  {enderecoPrincipal.cidade}/{enderecoPrincipal.estado}
                  <br />
                  {enderecoPrincipal.bairro}
                </p>
              </div>
            </section>

            <Separator />
          </>
        )}

        {/* Datas */}
        <section>
          <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">
            Histórico
          </h4>
          <div className="space-y-3">
            {/* Cliente desde */}
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">Cliente desde</p>
                <p className="text-sm text-[#111827]">
                  {format(new Date(cliente.created_at), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {formatDistanceToNow(new Date(cliente.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>

            {/* Último pedido */}
            {cliente.ultimo_pedido && (
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#6B7280]">Último pedido</p>
                  <p className="text-sm text-[#111827]">
                    {format(new Date(cliente.ultimo_pedido), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {formatDistanceToNow(new Date(cliente.ultimo_pedido), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
