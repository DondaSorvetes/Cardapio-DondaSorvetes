import { Truck } from "lucide-react";

export function FreteGratisBadge({ prazo }: { prazo?: string }) {
  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-md bg-[#E8F3EA] px-2 py-1 text-[10px] font-semibold leading-none text-[#356344]"
      title={
        prazo
          ? `Frete grátis ${prazo}`
          : "Este produto participa de uma campanha de frete grátis"
      }
      aria-label={prazo ? `Frete grátis, válido ${prazo}` : "Frete grátis"}
    >
      <Truck
        aria-hidden="true"
        className="h-3 w-3 shrink-0"
        strokeWidth={2.4}
      />
      Frete grátis
    </span>
  );
}
