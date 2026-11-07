"use client";

import { ConfiguracaoLoja } from "@/types/configuracoes";
import { Store, Clock, Truck, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusCardsProps {
  config: ConfiguracaoLoja;
}

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "Grátis";
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}

export function StatusCards({ config }: StatusCardsProps) {
  const cards = [
    {
      label: "Status da Loja",
      value: config.esta_aberto ? "Aberta" : "Fechada",
      icon: Store,
      iconWrap: config.esta_aberto ? "bg-emerald-50" : "bg-red-50",
      iconColor: config.esta_aberto ? "text-emerald-600" : "text-red-600",
      valueColor: config.esta_aberto ? "text-emerald-700" : "text-red-700",
    },
    {
      label: "Horário",
      value:
        config.horario_abertura && config.horario_fechamento
          ? `${config.horario_abertura} – ${config.horario_fechamento}`
          : "Não definido",
      icon: Clock,
      iconWrap: "bg-[#FDE6EE]",
      iconColor: "text-[#C8285F]",
      valueColor: "text-[#111827]",
    },
    {
      label: "Tempo Estimado",
      value:
        config.tempo_entrega_min != null && config.tempo_entrega_max != null
          ? `${config.tempo_entrega_min}–${config.tempo_entrega_max} min`
          : "Não definido",
      icon: Truck,
      iconWrap: "bg-blue-50",
      iconColor: "text-blue-600",
      valueColor: "text-[#111827]",
    },
    {
      label: "Taxa de Entrega",
      value: formatMoney(config.taxa_entrega),
      icon: DollarSign,
      iconWrap: "bg-amber-50",
      iconColor: "text-amber-600",
      valueColor: "text-[#111827]",
    },
  ];

  return (
    <div className="px-6 pt-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  card.iconWrap
                )}
              >
                <card.icon className={cn("w-5 h-5", card.iconColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#6B7280]">{card.label}</p>
                <p
                  className={cn(
                    "text-sm font-semibold truncate",
                    card.valueColor
                  )}
                >
                  {card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
