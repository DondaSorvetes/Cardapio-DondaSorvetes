import { CalendarClock, Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarAgendamento } from "@/lib/retirada";
import { isPickupType } from "./order-status";

/**
 * Selo da modalidade do pedido para o painel:
 * Entrega · Retirar agora · Retirada agendada (com dia e janela).
 */
export function ModalidadeBadge({
  tipo,
  agendadoPara,
  size = "sm",
  className,
}: {
  tipo: string | null | undefined;
  agendadoPara?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const base =
    size === "md"
      ? "gap-1.5 rounded-md px-2.5 py-1 text-[12px]"
      : "gap-1 rounded px-1.5 py-0.5 text-[10px]";
  const icon = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  if (!isPickupType(tipo)) {
    return (
      <span className={cn("inline-flex items-center font-medium bg-[#F3F4F6] text-[#4B5563]", base, className)}>
        <Truck aria-hidden="true" className={icon} />
        Entrega
      </span>
    );
  }

  const agendamento = formatarAgendamento(agendadoPara);
  if (agendamento) {
    return (
      <span className={cn("inline-flex items-center font-semibold border border-amber-300 bg-amber-50 text-amber-800", base, className)}>
        <CalendarClock aria-hidden="true" className={icon} />
        Retirada agendada · {agendamento}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center font-semibold border border-violet-200 bg-violet-50 text-violet-700", base, className)}>
      <Store aria-hidden="true" className={icon} />
      Retirar agora
    </span>
  );
}
