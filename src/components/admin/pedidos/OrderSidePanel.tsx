"use client";

import { Pedido, statusConfig } from "@/types/pedido";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  Package,
  CreditCard,
  Bike,
  Store,
  User,
  Phone,
  Printer,
  MessageCircle,
  MapPin,
  ChefHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { OrderPrint, type OrderPrintTipo } from "./OrderPrint";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OrderSidePanelProps {
  pedido: Pedido;
  onStatusChange?: (newStatus: Pedido["status"]) => void;
}

function formatMoney(value?: number | string | null) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function entregaLabel(tipo: string) {
  if (tipo === "delivery" || tipo === "entrega") return "Entrega";
  return "Retirada";
}

export function OrderSidePanel({
  pedido,
}: OrderSidePanelProps) {
  const [printTipo, setPrintTipo] = useState<OrderPrintTipo | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusInfo = statusConfig[pedido.status];
  const tempoDecorrido = formatDistanceToNow(new Date(pedido.created_at), {
    addSuffix: false,
    locale: ptBR,
  });
  const isDelivery =
    pedido.tipo_entrega === "delivery" || pedido.tipo_entrega === "entrega";

  // Impressão NÃO altera status — aceite é só pelo botão/auto-aceite.
  useEffect(() => {
    if (!printTipo) return;

    setIsPrinting(true);
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
      setIsPrinting(false);
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
    if (isPrinting) return;
    setPrintTipo(tipo);
  };

  const makeCall = () => {
    if (!pedido.cliente_telefone) return;
    window.location.href = `tel:${pedido.cliente_telefone}`;
  };

  const openWhatsApp = () => {
    if (!pedido.cliente_telefone) return;
    const phone = pedido.cliente_telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}`, "_blank");
  };

  const copyAddress = async () => {
    if (!pedido.endereco_completo) return;
    try {
      await navigator.clipboard.writeText(pedido.endereco_completo);
      setCopied(true);
      toast.success("Endereço copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o endereço");
    }
  };

  return (
    <div className="w-[300px] h-full bg-[#F8F9FC] border-l border-[#E5E7EB] flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Tempo */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[#C8285F]" />
            <span className="text-xs font-medium text-[#6B7280]">
              Tempo decorrido
            </span>
          </div>
          <p className="text-2xl font-bold text-[#111827] tracking-tight">
            {tempoDecorrido}
          </p>
        </div>

        {/* Status */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Package className="w-4 h-4 text-[#C8285F]" />
            <span className="text-xs font-medium text-[#6B7280]">Status</span>
          </div>
          <span
            className={cn(
              "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border",
              statusInfo.color
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", statusInfo.dot)} />
            {statusInfo.label}
          </span>
        </div>

        {/* Pagamento */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-[#C8285F]" />
            <span className="text-xs font-medium text-[#6B7280]">Pagamento</span>
          </div>
          <p className="text-sm font-semibold text-[#111827] capitalize">
            {pedido.meio_pagamento}
          </p>
          {pedido.troco_para != null && Number(pedido.troco_para) > 0 && (
            <p className="text-xs text-[#6B7280] mt-1">
              Troco: {formatMoney(pedido.troco_para)}
            </p>
          )}
        </div>

        {/* Entrega */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isDelivery ? (
              <Bike className="w-4 h-4 text-[#C8285F]" />
            ) : (
              <Store className="w-4 h-4 text-[#C8285F]" />
            )}
            <span className="text-xs font-medium text-[#6B7280]">
              Tipo
            </span>
          </div>
          <p className="text-sm font-semibold text-[#111827]">
            {entregaLabel(pedido.tipo_entrega)}
          </p>
        </div>

        {/* Cliente */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <User className="w-4 h-4 text-[#C8285F]" />
            <span className="text-xs font-medium text-[#6B7280]">Cliente</span>
          </div>
          <p className="text-sm font-semibold text-[#111827] break-words">
            {pedido.cliente_nome}
          </p>
          {pedido.cliente_telefone && (
            <p className="text-xs text-[#6B7280] mt-1">
              {pedido.cliente_telefone}
            </p>
          )}
        </div>

        <Separator className="my-1" />

        {/* Ações */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide text-center">
            Ações rápidas
          </p>

          {pedido.cliente_telefone && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 justify-center gap-2"
                onClick={makeCall}
              >
                <Phone className="w-4 h-4 shrink-0" />
                Ligar
              </Button>

              <Button
                size="sm"
                className="w-full h-10 justify-center gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white"
                onClick={openWhatsApp}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                WhatsApp
              </Button>
            </>
          )}

          {pedido.endereco_completo && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 justify-center gap-2"
              onClick={copyAddress}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              {copied ? "Copiado!" : "Copiar endereço"}
            </Button>
          )}

          <div className="pt-1 space-y-2">
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide text-center">
              Impressão
            </p>

            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 justify-center gap-2"
              disabled={isPrinting}
              onClick={() => handlePrint("cozinha")}
            >
              <ChefHat className="w-4 h-4 shrink-0" />
              Cupom cozinha
            </Button>

            <Button
              size="sm"
              className="w-full h-10 justify-center gap-2 bg-[#C8285F] hover:bg-[#E33E70] text-white"
              disabled={isPrinting}
              onClick={() => handlePrint("completo")}
            >
              <Printer className="w-4 h-4 shrink-0" />
              {isPrinting ? "Preparando..." : "Imprimir completo"}
            </Button>

            <p className="text-[10px] text-center text-[#9CA3AF] leading-relaxed px-1">
              Completo imprime cozinha + entrega. A impressão não altera o status
              do pedido.
            </p>
          </div>
        </div>
      </div>

      {/* Área de impressão (só aparece no print) */}
      {printTipo && <OrderPrint pedido={pedido} tipo={printTipo} />}
    </div>
  );
}
