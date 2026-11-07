"use client";

import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import type { Product, Tag } from "@/data/tipos";
import { cn } from "@/lib/utils";
import { TagIcone } from "@/components/ui/TagIcone";
import { readableTagForeground } from "@/lib/accessibility/contrast";
import { ProductCard, type ProductCardVariant } from "./CardProduto";

/**
 * Carrossel único do topo do cardápio. A tag exibida é escolhida pelo admin
 * (tags.destaque_cardapio) — só uma por vez.
 */
export function FeaturedCarousel({
  tag,
  products,
  variant,
}: {
  tag: Tag;
  products: Product[];
  variant: Extract<ProductCardVariant, "promo" | "vitrine">;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [verTodos, setVerTodos] = useState(false);
  const titulo = variant === "promo" ? tag.nome : tag.nome.toUpperCase();

  const scroll = () =>
    scrollRef.current?.scrollBy({
      left: scrollRef.current.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });

  return (
    <section
      aria-labelledby="destaque-topo"
      className="space-y-3 border-b border-border pb-5 font-cardapio"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="destaque-topo"
          className="flex min-w-0 items-center gap-2 font-titulo text-[28px] leading-none tracking-wide text-foreground sm:text-[32px]"
        >
          <TagIcone
            nome={tag.nome}
            icone={tag.icone}
            cor={tag.cor_fundo || "#EF4444"}
            corSimbolo={readableTagForeground(tag.cor_fundo || "#EF4444", tag.cor_texto || "#FFFFFF")}
            className="h-8 w-8"
          />
          <span className="truncate pt-0.5">{titulo}</span>
        </h2>
        {products.length > 1 && (
          <button
            type="button"
            onClick={() => setVerTodos((v) => !v)}
            aria-expanded={verTodos}
            className="inline-flex shrink-0 items-center gap-0.5 text-sm text-foreground/80 hover:text-foreground"
          >
            {verTodos ? "Ver menos" : "Ver todos"}
            <ChevronRight
              aria-hidden="true"
              className={cn("h-5 w-5 transition-transform", verTodos && "rotate-90")}
            />
          </button>
        )}
      </header>

      {verTodos ? (
        <div
          className={cn(
            "grid gap-4",
            variant === "promo"
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
          )}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} variant={variant} destaqueTag={tag} />
          ))}
        </div>
      ) : (
        <div className="relative">
          <div
            ref={scrollRef}
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {products.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "shrink-0 snap-start",
                  variant === "promo"
                    ? "w-[85%] max-w-[400px]"
                    : "w-[46%] max-w-[220px] sm:w-52",
                )}
              >
                <ProductCard product={p} variant={variant} destaqueTag={tag} />
              </div>
            ))}
          </div>
          {products.length > 1 && (
            <button
              type="button"
              onClick={scroll}
              aria-label="Próximos destaques"
              className={cn("absolute right-0 z-10 flex", variant === "promo" ? "top-[72px]" : "top-[38%]", " h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-md")}
            >
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
