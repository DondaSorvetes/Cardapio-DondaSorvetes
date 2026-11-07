"use client";

import { ConfiguracaoLoja } from "@/types/configuracoes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";

interface DeliveryCardProps {
  config: ConfiguracaoLoja;
  onChange: (
    field: keyof ConfiguracaoLoja,
    value: ConfiguracaoLoja[keyof ConfiguracaoLoja]
  ) => void;
}

export function DeliveryCard({ config, onChange }: DeliveryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-[#FDE6EE] flex items-center justify-center">
          <Truck className="w-5 h-5 text-[#C8285F]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#111827]">Delivery</h3>
          <p className="text-sm text-[#6B7280]">Configurações de entrega</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Taxa e Pedido Mínimo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="taxa_entrega" className="text-sm font-medium text-[#111827] mb-2 block">
              Taxa de Entrega (R$)
            </Label>
            <Input
              id="taxa_entrega"
              type="number"
              step="0.01"
              min="0"
              value={config.taxa_entrega || ""}
              onChange={(e) => onChange("taxa_entrega", parseFloat(e.target.value) || 0)}
              placeholder="0,00"
              className="h-11"
            />
          </div>

          <div>
            <Label htmlFor="pedido_minimo" className="text-sm font-medium text-[#111827] mb-2 block">
              Pedido Mínimo (R$)
            </Label>
            <Input
              id="pedido_minimo"
              type="number"
              step="0.01"
              min="0"
              value={config.pedido_minimo || ""}
              onChange={(e) => onChange("pedido_minimo", parseFloat(e.target.value) || 0)}
              placeholder="0,00"
              className="h-11"
            />
          </div>
        </div>

        {/* Tempo de Entrega */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tempo_entrega_min" className="text-sm font-medium text-[#111827] mb-2 block">
              Tempo Mínimo (min)
            </Label>
            <Input
              id="tempo_entrega_min"
              type="number"
              min="0"
              value={config.tempo_entrega_min || ""}
              onChange={(e) => onChange("tempo_entrega_min", parseInt(e.target.value) || 0)}
              placeholder="30"
              className="h-11"
            />
          </div>

          <div>
            <Label htmlFor="tempo_entrega_max" className="text-sm font-medium text-[#111827] mb-2 block">
              Tempo Máximo (min)
            </Label>
            <Input
              id="tempo_entrega_max"
              type="number"
              min="0"
              value={config.tempo_entrega_max || ""}
              onChange={(e) => onChange("tempo_entrega_max", parseInt(e.target.value) || 0)}
              placeholder="45"
              className="h-11"
            />
          </div>
        </div>

        {/* Resumo */}
        {(config.taxa_entrega || config.pedido_minimo || config.tempo_entrega_min || config.tempo_entrega_max) && (
          <div className="bg-[#FDE6EE] rounded-xl p-4 border border-[#C8285F]/20">
            <p className="text-xs font-semibold text-[#C8285F] mb-2">Resumo do Delivery:</p>
            <div className="space-y-1">
              {config.taxa_entrega != null && (
                <p className="text-sm text-[#111827]">
                  <span className="font-medium">Taxa:</span> R${" "}
                  {Number(config.taxa_entrega).toFixed(2).replace(".", ",")}
                </p>
              )}
              {config.pedido_minimo != null && (
                <p className="text-sm text-[#111827]">
                  <span className="font-medium">Pedido mínimo:</span> R${" "}
                  {Number(config.pedido_minimo).toFixed(2).replace(".", ",")}
                </p>
              )}
              {config.tempo_entrega_min && config.tempo_entrega_max && (
                <p className="text-sm text-[#111827]">
                  <span className="font-medium">Entrega estimada:</span> {config.tempo_entrega_min}–{config.tempo_entrega_max} minutos
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
