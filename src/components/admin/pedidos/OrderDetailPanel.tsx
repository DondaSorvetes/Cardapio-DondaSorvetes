"use client";

import { Pedido, statusConfig } from "@/types/pedido";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderPrint, type OrderPrintTipo } from "./OrderPrint";
import {
  extractComplementos,
  groupComplementos,
} from "@/lib/utils/pedido";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  MapPin,
  Package,
  CreditCard,
  Clock,
  User,
  MessageSquare,
  ExternalLink,
  Copy,
  Printer,
  ShoppingBag,
  FileText,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatters";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface OrderDetailPanelProps {
  pedido: Pedido;
  onStatusChange?: (newStatus: Pedido["status"]) => void;
}

export function OrderDetailPanel({
  pedido,
  onStatusChange,
}: OrderDetailPanelProps) {
  const [copying, setCopying] = useState(false);
  const [printTipo, setPrintTipo] = useState<OrderPrintTipo | null>(null);
  const statusInfo = statusConfig[pedido.status];
  const tempoDecorrido = formatDistanceToNow(new Date(pedido.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  // Impressão NÃO altera status — aceite é só pelo botão/auto-aceite.
  useEffect(() => {
    if (!printTipo) return;

    let printed = false;
    let finished = false;

    const runPrint = () => {
      if (printed) return;
      printed = true;
      window.print();
    };

    const done = () => {
      if (finished) return;
      finished = true;
      setPrintTipo(null);
    };

    const t1 = window.setTimeout(runPrint, 250);
    const t2 = window.setTimeout(done, 8000);

    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("afterprint", done);
    };
  }, [printTipo]);

  const handlePrint = (tipo: OrderPrintTipo) => {
    setPrintTipo(tipo);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const openWhatsApp = () => {
    if (pedido.cliente_telefone) {
      const phone = pedido.cliente_telefone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }
  };

  const openMaps = () => {
    if (pedido.endereco_completo) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          pedido.endereco_completo
        )}`,
        "_blank"
      );
    }
  };

  const getNextActions = () => {
    const actions = [];
    if (pedido.status === "pendente") {
      actions.push({
        label: "Aceitar Pedido",
        status: "preparando" as const,
        variant: "default" as const,
      });
    }
    if (pedido.status === "preparando") {
      actions.push({
        label: "Saiu para Entrega",
        status: "saiu_entrega" as const,
        variant: "default" as const,
      });
    }
    if (pedido.status === "saiu_entrega") {
      actions.push({
        label: "Marcar como Entregue",
        status: "entregue" as const,
        variant: "default" as const,
      });
    }
    if (pedido.status !== "cancelado" && pedido.status !== "entregue") {
      actions.push({
        label: "Cancelar",
        status: "cancelado" as const,
        variant: "destructive" as const,
      });
    }
    return actions;
  };

  return (
    <div className="flex-1 h-full bg-white flex flex-col">
      {/* Header - Compacto */}
      <div className="px-6 py-4 border-b border-[#E5E7EB]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-[#111827]">
                Pedido #{pedido.id.slice(0, 8)}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
                  statusInfo.color
                )}
              >
                <span
                  className={cn("w-1.5 h-1.5 rounded-full", statusInfo.dot)}
                />
                {statusInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#6B7280]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <span>•</span>
              <span>{tempoDecorrido}</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePrint("cozinha")}>
                🍳 Cupom da Cozinha
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint("completo")}>
                📄 Completo (Cozinha + Entrega)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actions */}
        {getNextActions().length > 0 && (
          <div className="flex items-center gap-2">
            {getNextActions().map((action) => (
              <Button
                key={action.status}
                variant={action.variant}
                size="sm"
                onClick={() => onStatusChange?.(action.status)}
                className={cn(
                  action.variant === "default" &&
                    "bg-[#C8285F] hover:bg-[#E33E70]"
                )}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="flex-1 flex flex-col">
        <div className="px-6 border-b border-[#E5E7EB]">
          <TabsList className="h-12 bg-transparent p-0 gap-1">
            <TabsTrigger
              value="resumo"
              className="data-[state=active]:bg-[#FDE6EE] data-[state=active]:text-[#C8285F] rounded-lg px-4"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Resumo
            </TabsTrigger>
            <TabsTrigger
              value="cliente"
              className="data-[state=active]:bg-[#FDE6EE] data-[state=active]:text-[#C8285F] rounded-lg px-4"
            >
              <User className="w-4 h-4 mr-2" />
              Cliente
            </TabsTrigger>
            <TabsTrigger
              value="detalhes"
              className="data-[state=active]:bg-[#FDE6EE] data-[state=active]:text-[#C8285F] rounded-lg px-4"
            >
              <FileText className="w-4 h-4 mr-2" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="data-[state=active]:bg-[#FDE6EE] data-[state=active]:text-[#C8285F] rounded-lg px-4"
            >
              <Clock className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* Aba: Resumo */}
          <TabsContent value="resumo" className="p-6 space-y-5 mt-0">
            {/* Produtos */}
            <section>
              <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-[#C8285F]" />
                Itens do Pedido ({pedido.itens.length})
              </h3>
              <div className="space-y-2">
                {pedido.itens.map((item, index) => {
                  const complementos = extractComplementos(item);
                  const gruposAdicionais = groupComplementos(complementos);

                  return (
                    <div
                      key={item.uid || index}
                      className="bg-[#F8F9FC] rounded-xl p-4 flex gap-3 hover:bg-gray-50 transition-colors"
                    >
                    {item.produto.image ? (
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-white flex-shrink-0">
                        <Image
                          src={item.produto.image}
                          alt={item.produto.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-[#6B7280]" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium text-[#111827] text-sm">
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 mr-1.5 rounded-md bg-[#C8285F] text-white text-xs font-bold">
                            {item.qty}x
                          </span>
                          {item.produto.name}
                        </h4>
                        <span className="text-sm font-semibold text-[#111827] flex-shrink-0">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] mb-2">
                        {formatCurrency(item.produto.price)} cada
                      </p>

                      {gruposAdicionais.length > 0 && (
                        <div className="space-y-2 mb-2 bg-white rounded-lg p-2.5 border border-[#E5E7EB]">
                          {gruposAdicionais.map((grupo, gIdx) => (
                            <div key={gIdx}>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C8285F] mb-1">
                                {grupo.groupName}
                              </p>
                              <div className="space-y-0.5">
                                {grupo.items.map((comp, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className="text-[#111827]">
                                      + {comp.name}
                                    </span>
                                    {Number(comp.price) > 0 ? (
                                      <span className="text-[#6B7280] font-medium tabular-nums">
                                        +{formatCurrency(comp.price)}
                                      </span>
                                    ) : (
                                      <span className="text-[#9CA3AF] text-[10px]">
                                        incluso
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {item.observacoes && (
                        <p className="text-xs text-[#6B7280] italic bg-white px-2 py-1 rounded border border-[#E5E7EB]">
                          💬 {item.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </section>

            <Separator />

            {/* Resumo Financeiro */}
            <section>
              <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#C8285F]" />
                Resumo Financeiro
              </h3>
              <div className="bg-[#F8F9FC] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">Subtotal</span>
                  <span className="text-sm font-medium text-[#111827]">
                    {formatCurrency(pedido.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">
                    Taxa de Entrega
                  </span>
                  <span className="text-sm font-medium text-[#111827]">
                    {formatCurrency(pedido.taxa_entrega)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-[#111827]">
                    Total
                  </span>
                  <span className="text-xl font-bold text-[#C8285F]">
                    {formatCurrency(pedido.total)}
                  </span>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* Aba: Cliente */}
          <TabsContent value="cliente" className="p-6 space-y-5 mt-0">
            {/* Informações do Cliente */}
            <section className="bg-[#F8F9FC] rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#C8285F] flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#111827]">
                      {pedido.cliente_nome}
                    </h3>
                    {pedido.cliente_telefone && (
                      <p className="text-sm text-[#6B7280]">
                        {pedido.cliente_telefone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {pedido.cliente_telefone && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(pedido.cliente_telefone!)}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copying ? "Copiado!" : "Copiar"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={openWhatsApp}
                    className="flex-1 bg-[#25D366] hover:bg-[#20BA5A]"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              )}
            </section>

            {/* Endereço */}
            {pedido.endereco_completo && (
              <section>
                <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#C8285F]" />
                  Endereço de Entrega
                </h3>
                <div className="bg-[#F8F9FC] rounded-xl p-4">
                  <p className="text-sm text-[#111827] mb-4 leading-relaxed">
                    {pedido.endereco_completo}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openMaps}
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir no Google Maps
                  </Button>
                </div>
              </section>
            )}
          </TabsContent>

          {/* Aba: Detalhes */}
          <TabsContent value="detalhes" className="p-6 space-y-5 mt-0">
            {/* Informações do Pedido */}
            <section>
              <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-[#C8285F]" />
                Informações do Pedido
              </h3>
              <div className="bg-[#F8F9FC] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">
                    Tipo de Entrega
                  </span>
                  <span className="text-sm font-medium text-[#111827] capitalize">
                    {pedido.tipo_entrega}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">
                    Forma de Pagamento
                  </span>
                  <span className="text-sm font-medium text-[#111827] capitalize">
                    {pedido.meio_pagamento}
                  </span>
                </div>
                {pedido.troco_para != null &&
                  Number(pedido.troco_para) > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">
                        Troco para
                      </span>
                      <span className="text-sm font-medium text-[#111827]">
                        {formatCurrency(pedido.troco_para)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Observações */}
            {pedido.observacoes && (
              <section>
                <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#C8285F]" />
                  Observações do Cliente
                </h3>
                <div className="bg-[#F8F9FC] rounded-xl p-4">
                  <p className="text-sm text-[#111827] leading-relaxed">
                    {pedido.observacoes}
                  </p>
                </div>
              </section>
            )}
          </TabsContent>

          {/* Aba: Histórico */}
          <TabsContent value="historico" className="p-6 space-y-5 mt-0">
            <section>
              <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#C8285F]" />
                Linha do Tempo
              </h3>
              <div className="bg-[#F8F9FC] rounded-xl p-5 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#C8285F] flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#111827]">
                      Pedido criado
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {format(
                        new Date(pedido.created_at),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </p>
                  </div>
                </div>

                {pedido.updated_at !== pedido.created_at && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#6B7280] flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#111827]">
                        Última atualização
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {format(
                          new Date(pedido.updated_at),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      statusInfo.dot.replace("bg-", "bg-opacity-20 bg-")
                    )}
                  >
                    <span
                      className={cn("w-3 h-3 rounded-full", statusInfo.dot)}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#111827]">
                      Status atual
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {statusInfo.label}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Print Views - Ocultos na tela, visíveis apenas na impressão */}
      {printTipo && <OrderPrint pedido={pedido} tipo={printTipo} />}
    </div>
  );
}
