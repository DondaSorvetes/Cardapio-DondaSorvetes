"use client";

import { ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import type { Category } from "@/data/tipos";
import { cn } from "@/lib/utils";
import { ProductCard } from "./CardProduto";

export function ProductSection({ category }: { category: Category }) {
  const [aberta, setAberta] = useState(true);
  const listaId = useId();
  return (
    <section
      id={`categoria-${category.id}`}
      className="scroll-mt-24 font-cardapio"
    >
      <header>
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          aria-expanded={aberta}
          aria-controls={listaId}
          className="flex w-full items-center justify-between gap-3 py-1 text-left"
        >
          <h2 className="font-titulo text-[28px] uppercase leading-none tracking-wide text-foreground sm:text-[32px]">
            {category.name}
          </h2>
          <ChevronUp
            aria-hidden="true"
            className={cn(
              "h-6 w-6 shrink-0 text-foreground transition-transform",
              !aberta && "rotate-180",
            )}
          />
        </button>
        {category.subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{category.subtitle}</p>
        )}
      </header>
      <div
        id={listaId}
        hidden={!aberta}
        className="mt-2 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 [&>*]:border-b [&>*]:border-border"
      >
        {category.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
