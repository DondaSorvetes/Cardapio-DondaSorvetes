"use client";

import {
  formatBRL,
  getProductUnitPrice,
  hasProductPromo,
  type Product,
} from "@/data/tipos";
import { cn } from "@/lib/utils";

/**
 * Exibe o preço normal ou, em promoção, o preço antigo riscado e o preço atual.
 */
export function PrecoProduto({
  product,
  className,
  size = "md",
}: {
  product: Product;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const promo = hasProductPromo(product);
  const unit = getProductUnitPrice(product);

  const priceCls =
    size === "lg"
      ? "text-lg font-bold"
      : size === "sm"
        ? "text-sm font-bold"
        : "text-sm font-bold sm:text-base";

  if (!promo) {
    return (
      <p className={cn(priceCls, "text-foreground tabular-nums", className)}>
        {formatBRL(unit)}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] text-muted-foreground line-through tabular-nums">
          {formatBRL(product.price)}
        </span>
        <span className={cn(priceCls, "tabular-nums text-primary")}>
          {formatBRL(unit)}
        </span>
      </div>
    </div>
  );
}
