"use client";

import { cn } from "@/lib/utils";
import { TagIcone } from "@/components/ui/TagIcone";

export type CatalogTagLike = {
  id?: string | number;
  nome: string;
  cor_fundo?: string | null;
  cor_texto?: string | null;
  icone?: string | null;
} | null | undefined;

/** Badge igual ao do cardápio (cliente) — cores da tabela tags */
export function CatalogTagBadge({
  tag,
  className,
  size = "sm",
}: {
  tag: CatalogTagLike;
  className?: string;
  size?: "sm" | "md";
}) {
  if (!tag?.nome) return null;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md font-bold tracking-wide shrink-0",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
      style={{
        backgroundColor: tag.cor_fundo || "#FDF0F4",
        color: tag.cor_texto || "#C8285F",
      }}
    >
      <TagIcone nome={tag.nome} icone={tag.icone} variante="glifo" className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {tag.nome}
    </span>
  );
}
