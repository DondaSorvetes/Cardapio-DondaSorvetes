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
      ? "rounded-md px-2 py-0.5 text-[12px]"
      : "rounded px-1.5 py-0.5 text-[10px]";

  if (!isPickupType(tipo)) {
    return (
      <span className={cn("inline-flex items-center font-medium bg-[#F3F4F6] text-[#4B5563]", base, className)}>
        Entrega
      </span>
    );
  }

  const agendamento = formatarAgendamento(agendadoPara);
  if (agendamento) {
    return (
      <span className={cn("inline-flex items-center font-medium bg-amber-50 text-amber-800", base, className)}>
        Retirada agendada · {agendamento}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center font-medium bg-[#F3F4F6] text-[#4B5563]", base, className)}>
      Retirada
    </span>
  );
}
