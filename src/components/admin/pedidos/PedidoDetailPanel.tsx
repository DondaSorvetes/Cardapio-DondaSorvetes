"use client";

import { rotuloPagamento } from "@/lib/pagamento";
import { useEffect, useState } from "react";
import { StorageImage as Image } from "@/components/ui/storage-image";
import {
  MapPin,
  ExternalLink,
  Copy,
  Printer,
  X,
  MessageSquare,
} from "lucide-react";
import type { Pedido } from "@/types/pedido";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPhone } from "@/lib/utils/formatters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { extractComplementos, groupComplementos } from "@/lib/utils/pedido";
import { toast } from "sonner";
import { OrderPrint, type OrderPrintTipo } from "./OrderPrint";
import {
  shortOrderId,
  tipoEntregaLabel,
  isDeliveryType,
  getOrderActions,
  STATUS_META,
  statusLabel as labelDoStatus,
  type OrderAction,
} from "./order-status";
import { ModalidadeBadge } from "./ModalidadeBadge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { OrderElapsedTimer } from "./OrderElapsedTimer";

interface PedidoDetailPanelProps {
  pedido: Pedido;
  onStatusChange: (
    status: Pedido["status"],
  ) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  busy?: boolean;
  /** Nome do entregador atribuído (null = sem entregador). */
  entregadorNome?: string | null;
}

const orderDateTime = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

// Compact status badge colors
const STATUS_BADGE: Record<Pedido["status"], string> = {
  pendente: "bg-pink-100 text-pink-800",
  confirmado: "bg-indigo-100 text-indigo-700",
  preparando: "bg-blue-100   text-blue-700",
  saiu_entrega: "bg-orange-100 text-orange-700",
  entregue: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-red-100    text-red-700",
};

export function PedidoDetailPanel({
  pedido,
  onStatusChange,
  onClose,
  busy = false,
  entregadorNome = null,
}: PedidoDetailPanelProps) {
  const [printTipo, setPrintTipo] = useState<OrderPrintTipo | null>(null);
  const [pendingAction, setPendingAction] = useState<OrderAction | null>(null);
  const actions = getOrderActions(pedido);
  const delivery = isDeliveryType(pedido.tipo_entrega);

  const primaryActions = actions.filter(
    (a) =>
      a.variant === "primary" ||
      a.variant === "success" ||
      a.variant === "warning",
  );
  const secondaryActions = actions.filter((a) => a.variant === "secondary");
  const dangerActions = actions.filter((a) => a.variant === "danger");

  const statusLabel = STATUS_META[pedido.status]
    ? labelDoStatus(pedido.status, pedido.tipo_entrega)
    : pedido.status;
  const statusBadge =
    STATUS_BADGE[pedido.status] ?? "bg-gray-100 text-gray-600";

  const hasPrimaryEnterHint = primaryActions.some(
    (a) => a.status === "preparando" && !a.printAfter,
  );

  // â”€â”€ Print logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (
        e.defaultPrevented ||
        pendingAction ||
        (e.target as HTMLElement)?.closest(
          'button, a, [role="menu"], [role="alertdialog"], [contenteditable="true"]',
        )
      )
        return;
      if (e.key === "Enter" && !busy) {
        const accept = actions.find(
          (a) => a.status === "preparando" && !a.printAfter,
        );
        if (accept) {
          e.preventDefault();
          void onStatusChange(accept.status);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, busy, onClose, onStatusChange, pendingAction]);

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar. Tente novamente.");
    }
  };

  const openWhatsApp = () => {
    if (!pedido.cliente_telefone) return;
    const phone = pedido.cliente_telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}`, "_blank");
  };

  const openMaps = () => {
    if (!pedido.endereco_completo) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.endereco_completo)}`,
      "_blank",
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-white">
      {/* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="shrink-0 border-b border-[#F0EEF3] px-3 sm:px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h2 className="text-lg font-bold text-[#111827] leading-none">
              Pedido #{shortOrderId(pedido.id)}
            </h2>

            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
                statusBadge,
              )}
            >
              {statusLabel}
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1 shrink-0">
            <OrderElapsedTimer createdAt={pedido.created_at} compact />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Imprimir pedido"
                  title="Imprimir pedido"
                  className="ml-1 flex h-9 w-9 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#374151] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40"
                >
                  <Printer aria-hidden="true" className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPrintTipo("cozinha")}>
                  Cupom da cozinha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPrintTipo("completo")}>
                  Completo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#374151] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-line: time */}
        <p className="mt-1 text-xs text-[#6B7280]">
          {orderDateTime.format(new Date(pedido.created_at))}
          {" · "}
          {tipoEntregaLabel(pedido.tipo_entrega)}
          {delivery && (pedido.status === "saiu_entrega" || pedido.status === "entregue") && (
            <>
              {" · "}
              {entregadorNome ? `Entregador: ${entregadorNome}` : "Sem entregador"}
            </>
          )}
        </p>
        <ModalidadeBadge
          tipo={pedido.tipo_entrega}
          agendadoPara={pedido.agendado_para}
          size="md"
          className="mt-2"
        />
      </div>

      {/* â”€â”€ ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* â”€â”€ CONTENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-3 sm:px-5 py-4 space-y-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Produtos
          </h3>
          {/* Items */}
          <ul className="divide-y divide-[#F3F4F6]">
            {pedido.itens.map((item, index) => {
              const complementos = extractComplementos(item);
              const grupos = groupComplementos(complementos);
              return (
                <li
                  key={item.uid || item.id || index}
                  className="py-3 first:pt-0"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Qty */}
                    <span className="mt-px flex h-5 min-w-[24px] items-center justify-center rounded bg-[#FDF0F4] px-1 text-[11px] font-bold text-[#C8285F] tabular-nums shrink-0">
                      {item.qty}x
                    </span>

                    {/* Name + extras */}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-[#111827] leading-snug">
                        {item.produto.name}
                      </span>

                      {grupos.map((grupo, gi) => (
                        <div key={gi} className="mt-0.5">
                          {grupo.items.map((opcao, oi) => (
                            <p key={oi} className="text-xs text-[#9CA3AF]">
                              + {opcao.name}
                              {Number(opcao.price) > 0
                                ? ` · ${formatCurrency(opcao.price)}`
                                : ""}
                            </p>
                          ))}
                        </div>
                      ))}

                      {typeof item.colher === "boolean" && (
                        <p
                          className={cn(
                            "mt-1 inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold",
                            item.colher
                              ? "bg-[#FDF0F4] text-[#C8285F]"
                              : "bg-[#F3F4F6] text-[#6B7280]",
                          )}
                        >
                          {item.colher ? "Com colher" : "Sem colher"}
                        </p>
                      )}

                      {item.observacoes && (
                        <p className="mt-0.5 text-xs text-[#6B7280] italic">
                          {item.observacoes}
                        </p>
                      )}
                    </div>

                    {/* Price + image */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-sm font-semibold text-[#111827] tabular-nums">
                        {formatCurrency(item.total)}
                      </span>
                      {item.produto.image && (
                        <div className="relative h-9 w-9 overflow-hidden rounded-md bg-[#F3F4F6] shrink-0">
                          <Image
                            src={item.produto.image}
                            alt={item.produto.name}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ObservaÃ§Ãµes do pedido */}
          {pedido.observacoes && (
            <p className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-900 leading-relaxed">
              {pedido.observacoes}
            </p>
          )}

          {/* Divider */}
          <div className="h-px bg-[#F3F4F6]" aria-hidden="true" />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cliente e entrega
          </h3>
          {/* Cliente */}
          <div className="space-y-1">
            <p className="font-medium text-[#111827]">{pedido.cliente_nome}</p>

            {pedido.cliente_telefone && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[#6B7280]">
                  {formatPhone(pedido.cliente_telefone)}
                </span>
                <button
                  type="button"
                  onClick={openWhatsApp}
                  aria-label="WhatsApp"
                  className="flex h-8 w-8 items-center justify-center rounded text-[#9CA3AF] hover:text-[#25D366] hover:bg-[#F0FDF4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40"
                >
                  <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => copy(pedido.cliente_telefone!)}
                  aria-label="Copiar telefone"
                  className="flex h-6 w-6 items-center justify-center rounded text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F9FAFB] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40"
                >
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {delivery && pedido.endereco_completo && (
              <div className="flex items-start gap-1.5 mt-1">
                <MapPin
                  aria-hidden="true"
                  className="h-3.5 w-3.5 mt-0.5 text-[#9CA3AF] shrink-0"
                />
                <div className="min-w-0">
                  <p className="break-words text-sm text-[#6B7280] leading-relaxed">
                    {pedido.endereco_completo}
                  </p>
                  <button
                    type="button"
                    onClick={openMaps}
                    aria-label="Abrir no mapa"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#C8285F] hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40"
                  >
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    Ver no mapa
                  </button>
                  <button
                    type="button"
                    onClick={() => void copy(pedido.endereco_completo!)}
                    className="ml-3 min-h-8 text-xs text-primary hover:underline"
                  >
                    Copiar endereço
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-[#F3F4F6]" aria-hidden="true" />

          <section aria-labelledby="order-payment-title" className="space-y-3">
            <h3
              id="order-payment-title"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Pagamento
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">
                  {formatCurrency(pedido.subtotal)}
                </dd>
              </div>
              {Number(pedido.desconto_cupom) > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    Desconto
                    {pedido.cupom_codigo ? ` · ${pedido.cupom_codigo}` : ""}
                  </dt>
                  <dd className="tabular-nums text-primary">
                    − {formatCurrency(pedido.desconto_cupom)}
                  </dd>
                </div>
              )}
              {pedido.cupom_codigo && !Number(pedido.desconto_cupom) && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Cupom</dt>
                  <dd>{pedido.cupom_codigo}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Taxa de entrega</dt>
                <dd className="tabular-nums">
                  {formatCurrency(pedido.taxa_entrega)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(pedido.total)}</dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">
              {rotuloPagamento(pedido.meio_pagamento)}
              {Number(pedido.troco_para) > 0 &&
                ` · troco para ${formatCurrency(pedido.troco_para)}`}
            </p>
          </section>
        </div>
      </div>

      {actions.length > 0 && (
        <footer className="shrink-0 border-t border-border bg-white px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            {primaryActions.slice(0, 1).map((action) => {
              return (
                <button
                  key={action.label}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void onStatusChange(action.status);
                  }}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {action.label}
                </button>
              );
            })}
            {(secondaryActions.length > 0 || dangerActions.length > 0) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
                  >
                    Mais ações
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {secondaryActions.map((action) => (
                    <DropdownMenuItem
                      key={action.label}
                      disabled={busy}
                      onSelect={() => {
                        void (async () => {
                          const result = await onStatusChange(action.status);
                          if (action.printAfter && result !== false)
                            setPrintTipo("completo");
                        })();
                      }}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                  {dangerActions.map((action) => (
                    <DropdownMenuItem
                      key={action.label}
                      disabled={busy}
                      className="text-red-700 focus:text-red-700"
                      onSelect={() => setPendingAction(action)}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {hasPrimaryEnterHint && (
            <p className="mt-1.5 hidden text-center text-[11px] text-muted-foreground sm:block">
              Enter para aceitar
            </p>
          )}
        </footer>
      )}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.label} pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido #{shortOrderId(pedido.id)} será cancelado. Confirme para
              continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                if (pendingAction) void onStatusChange(pendingAction.status);
                setPendingAction(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print */}
      {printTipo && <OrderPrint pedido={pedido} tipo={printTipo} />}
    </div>
  );
}
