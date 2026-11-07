"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StorageImage as Image } from "@/components/ui/storage-image";
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
  X,
  Check,
  Bike,
  ChefHat,
  Flag,
  XCircle,
  ShoppingBag,
} from "lucide-react";
import type { Pedido } from "@/types/pedido";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  extractComplementos,
  groupComplementos,
} from "@/lib/utils/pedido";
import { toast } from "sonner";
import { OrderPrint, type OrderPrintTipo } from "./OrderPrint";
import {
  STATUS_META,
  shortOrderId,
  tipoEntregaLabel,
  isDeliveryType,
  getOrderActions,
  type OrderAction,
} from "./order-status";
import { OrderElapsedTimer } from "./OrderElapsedTimer";

interface OrderDetailViewProps {
  pedido: Pedido;
  onStatusChange: (
    status: Pedido["status"]
  ) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  busy?: boolean;
}

const actionIcons = {
  check: Check,
  x: XCircle,
  chef: ChefHat,
  bike: Bike,
  flag: Flag,
  package: Package,
  print: Printer,
};

const actionStyles: Record<OrderAction["variant"], string> = {
  primary: "bg-[#C8285F] hover:bg-[#E33E70] text-white",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  warning: "bg-orange-500 hover:bg-orange-600 text-white",
  danger:
    "bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300",
  secondary:
    "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200",
};

export function OrderDetailView({
  pedido,
  onStatusChange,
  onClose,
  busy = false,
}: OrderDetailViewProps) {
  const [copying, setCopying] = useState(false);
  const [printTipo, setPrintTipo] = useState<OrderPrintTipo | null>(null);
  const meta = STATUS_META[pedido.status] ?? STATUS_META.pendente;
  const actions = getOrderActions(pedido);
  const delivery = isDeliveryType(pedido.tipo_entrega);

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
    // Fallback se afterprint não disparar em alguns browsers
    const t2 = window.setTimeout(done, 8000);
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("afterprint", done);
    };
  }, [printTipo]);

  // Atalhos: Enter aceita, Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Enter" && !busy) {
        // Aceita sem imprimir (Enter = Aceitar; use o botão para Aceitar e imprimir)
        const accept = actions.find(
          (a) => a.status === "preparando" && !a.printAfter
        );
        if (accept) {
          e.preventDefault();
          void onStatusChange(accept.status);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, busy, onClose, onStatusChange]);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopying(true);
    toast.success("Copiado");
    setTimeout(() => setCopying(false), 1500);
  };

  const openWhatsApp = () => {
    if (!pedido.cliente_telefone) return;
    const phone = pedido.cliente_telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}`, "_blank");
  };

  const openMaps = () => {
    if (!pedido.endereco_completo) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        pedido.endereco_completo
      )}`,
      "_blank"
    );
  };

  return (
    <motion.div
      key={pedido.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 h-full min-w-0 bg-white flex flex-col"
    >
      {/* Header */}
      <div className="px-6 lg:px-8 py-4 border-b border-[#E5E7EB] shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[#111827]">
                Pedido #{shortOrderId(pedido.id)}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border",
                  meta.badge
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </span>
              <OrderElapsedTimer createdAt={pedido.created_at} />
            </div>
            <p className="text-xs text-[#6B7280] mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
              <span className="text-[#D1D5DB]">·</span>
              {formatDistanceToNow(new Date(pedido.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Printer className="w-4 h-4 mr-1.5" />
                  Imprimir
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPrintTipo("cozinha")}>
                  Cupom da Cozinha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPrintTipo("completo")}>
                  Completo (Cozinha + Entrega)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
              aria-label="Fechar detalhes (Esc)"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => {
              const Icon = actionIcons[action.icon];
              return (
                <Button
                  key={`${action.label}-${action.status}-${action.printAfter ? "print" : "plain"}`}
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      const result = await onStatusChange(action.status);
                      // Só imprime se o status foi persistido (false = falha)
                      if (action.printAfter && result !== false) {
                        setPrintTipo("completo");
                      }
                    })();
                  }}
                  className={cn("h-9 font-semibold", actionStyles[action.variant])}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {action.label}
                </Button>
              );
            })}
            <span className="text-[10px] text-[#9CA3AF] ml-auto hidden md:inline">
              Enter aceita · Esc fecha
            </span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 lg:px-10 lg:py-8 space-y-5 w-full max-w-none">
          {/* Cliente */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFD] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-[#C8285F] flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#111827] truncate">
                    {pedido.cliente_nome}
                  </p>
                  {pedido.cliente_telefone && (
                    <p className="text-sm text-[#6B7280]">
                      {pedido.cliente_telefone}
                    </p>
                  )}
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {tipoEntregaLabel(pedido.tipo_entrega)}
                  </p>
                </div>
              </div>
              {pedido.cliente_telefone && (
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => copyToClipboard(pedido.cliente_telefone!)}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    {copying ? "OK" : "Copiar"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-[#25D366] hover:bg-[#20BA5A] text-white"
                    onClick={openWhatsApp}
                  >
                    <Phone className="w-3.5 h-3.5 mr-1" />
                    WhatsApp
                  </Button>
                </div>
              )}
            </div>

            {pedido.endereco_completo && (
              <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#C8285F] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#374151] leading-relaxed">
                      {pedido.endereco_completo}
                    </p>
                    <button
                      type="button"
                      onClick={openMaps}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#C8285F] hover:underline mt-1.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir no Google Maps
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Itens */}
          <section>
            <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#C8285F]" />
              Produtos ({pedido.itens.length})
            </h3>
            <div className="space-y-2">
              {pedido.itens.map((item, index) => {
                const complementos = extractComplementos(item);
                const gruposAdicionais = groupComplementos(complementos);

                return (
                  <div
                    key={item.uid || item.id || index}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 flex gap-3"
                  >
                    {item.produto.image ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F3F4F6] shrink-0">
                        <Image
                          src={item.produto.image}
                          alt={item.produto.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-[#9CA3AF]" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-[#111827] text-sm">
                          <span className="inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1 mr-1.5 rounded-md bg-[#C8285F] text-white text-[11px] font-bold">
                            {item.qty}x
                          </span>
                          {item.produto.name}
                        </h4>
                        <span className="text-sm font-semibold text-[#111827] shrink-0">
                          {formatCurrency(item.total)}
                        </span>
                      </div>

                      {gruposAdicionais.length > 0 && (
                        <div className="mt-2 space-y-1.5 rounded-lg bg-[#F8F9FC] p-2 border border-[#EEF0F4]">
                          {gruposAdicionais.map((grupo, gIdx) => (
                            <div key={gIdx}>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C8285F] mb-0.5">
                                {grupo.groupName}
                              </p>
                              {grupo.items.map((comp, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between text-xs text-[#4B5563]"
                                >
                                  <span>+ {comp.name}</span>
                                  {Number(comp.price) > 0 && (
                                    <span className="tabular-nums text-[#6B7280]">
                                      +{formatCurrency(comp.price)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {item.observacoes && (
                        <p className="text-xs text-[#6B7280] italic mt-1.5">
                          💬 {item.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Observações do pedido */}
          {pedido.observacoes && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-900 mb-1.5 text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Observações
              </h3>
              <p className="text-sm text-amber-900/80 leading-relaxed">
                {pedido.observacoes}
              </p>
            </section>
          )}

          {/* Pagamento / totais */}
          <section className="rounded-2xl border border-[#E5E7EB] p-4">
            <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#C8285F]" />
              Pagamento e totais
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Forma de pagamento</span>
                <span className="font-medium text-[#111827] capitalize">
                  {pedido.meio_pagamento}
                </span>
              </div>
              {pedido.troco_para != null && Number(pedido.troco_para) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Troco para</span>
                  <span className="font-medium text-[#111827]">
                    {formatCurrency(pedido.troco_para)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Subtotal</span>
                <span className="font-medium">{formatCurrency(pedido.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">
                  Taxa de entrega{!delivery ? " (retirada)" : ""}
                </span>
                <span className="font-medium">
                  {formatCurrency(pedido.taxa_entrega)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Desconto</span>
                <span className="font-medium text-[#6B7280]">R$ 0,00</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#111827]">Total</span>
                <span className="text-xl font-bold text-[#C8285F]">
                  {formatCurrency(pedido.total)}
                </span>
              </div>
            </div>
          </section>

          {/* Histórico simples */}
          <section>
            <h3 className="font-semibold text-[#111827] mb-3 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C8285F]" />
              Histórico
            </h3>
            <div className="rounded-xl border border-[#E5E7EB] p-4 space-y-4">
              <TimelineItem
                title="Pedido criado"
                subtitle={format(
                  new Date(pedido.created_at),
                  "dd/MM/yyyy 'às' HH:mm",
                  { locale: ptBR }
                )}
                active
              />
              {pedido.updated_at !== pedido.created_at && (
                <TimelineItem
                  title="Última atualização"
                  subtitle={format(
                    new Date(pedido.updated_at),
                    "dd/MM/yyyy 'às' HH:mm",
                    { locale: ptBR }
                  )}
                />
              )}
              <TimelineItem
                title={`Status: ${meta.label}`}
                subtitle="Estado atual do pedido"
                dotClass={meta.dot}
              />
            </div>
          </section>
        </div>
      </ScrollArea>

      {printTipo && <OrderPrint pedido={pedido} tipo={printTipo} />}
    </motion.div>
  );
}

function TimelineItem({
  title,
  subtitle,
  active,
  dotClass,
}: {
  title: string;
  subtitle: string;
  active?: boolean;
  dotClass?: string;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          active ? "bg-[#C8285F]" : "bg-[#E5E7EB]"
        )}
      >
        {dotClass ? (
          <span className={cn("w-2.5 h-2.5 rounded-full", dotClass)} />
        ) : (
          <Clock
            className={cn(
              "w-3.5 h-3.5",
              active ? "text-white" : "text-[#6B7280]"
            )}
          />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-[#111827]">{title}</p>
        <p className="text-xs text-[#6B7280]">{subtitle}</p>
      </div>
    </div>
  );
}
