"use client";

import { useState } from "react";
import { useModalHistory } from "@/hooks/useModalHistory";
import { ProductImage as Image } from "@/components/ui/product-image";
import dynamic from "next/dynamic";
import { BadgePercent, Gift } from "lucide-react";
import type { Product, Tag } from "@/data/tipos";
import { formatBRL, hasProductPromo } from "@/data/tipos";
import { TagBadge } from "@/components/ui/TagBadge";
import { FreteGratisBadge } from "@/components/ui/FreteGratisBadge";
const ProductDetailDialog = dynamic(() =>
  import("./ModalProduto").then((module) => module.ProductDetailDialog),
);
import { PrecoProduto } from "./PrecoProduto";
import { cn } from "@/lib/utils";

/**
 * - `lista`: linha do cardápio (imagem à esquerda, nome/descrição/preço à direita).
 * - `promo`: card horizontal do carrossel de promoções (selo com a economia).
 * - `vitrine`: card vertical do carrossel de destaque (ex.: mais vendidos).
 */
export type ProductCardVariant = "lista" | "promo" | "vitrine";

/** Preço antigo riscado + preço atual em verde (carrossel de promoções). */
function PrecoPromo({ product }: { product: Product }) {
  const promo = hasProductPromo(product);
  const atual = promo ? Number(product.precoPromocional) : product.price;
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm tabular-nums">
      {promo && (
        <span className="text-muted-foreground line-through">
          {formatBRL(product.price)}
        </span>
      )}
      <span className="font-semibold text-[#16A34A]">{formatBRL(atual)}</span>
    </p>
  );
}

/** Selo do carrossel de promoções: "NOME DA TAG - R$ economia". */
function SeloPromo({ product, tag }: { product: Product; tag?: Tag }) {
  const economia = hasProductPromo(product)
    ? product.price - Number(product.precoPromocional)
    : 0;
  const nome = tag?.nome ?? "Promoção";
  return (
    <span
      className="inline-flex w-fit max-w-full items-center truncate rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-wide"
      style={{
        backgroundColor: tag?.cor_fundo || "#EF4444",
        color: tag?.cor_texto || "#FFFFFF",
      }}
    >
      {economia > 0 ? `${nome} - ${formatBRL(economia)}` : nome}
    </span>
  );
}

function Foto({
  product,
  className,
}: {
  product: Product;
  className: string;
}) {
  return product.image ? (
    <Image
      src={product.image}
      alt={product.name}
      className={cn("object-cover", className)}
    />
  ) : (
    <div
      className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground",
        className,
      )}
    >
      <Gift className="h-8 w-8" />
    </div>
  );
}

export function ProductCard({
  product,
  variant = "lista",
  destaqueTag,
}: {
  product: Product;
  variant?: ProductCardVariant;
  /** Tag do carrossel (cor e nome do selo no card `promo`). */
  destaqueTag?: Tag;
}) {
  const [open, setOpen] = useState(false);
  useModalHistory(open, setOpen);
  const isDisponivel = product.disponivel !== false;
  const podePedir = isDisponivel;

  const handleOpen = () => {
    if (!isDisponivel) return;
    setOpen(true);
  };

  return (
    <>
      <article
        onClick={handleOpen}
        role="button"
        tabIndex={podePedir ? 0 : -1}
        aria-label={`Escolher ${product.name}`}
        aria-disabled={!podePedir}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpen();
          }
        }}
        className={cn(
          "group relative flex h-full overflow-hidden text-left font-cardapio",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl",
          variant === "vitrine" ? "flex-col gap-2" : "gap-3",
          variant === "lista" && "py-3",
          podePedir ? "cursor-pointer" : "cursor-not-allowed opacity-75",
        )}
      >
        {/* Fita de Esgotado */}
        {!isDisponivel && (
          <>
            <div className="absolute inset-0 z-10 rounded-xl bg-black/20" />
            <div className="absolute top-6 -right-12 z-20 w-48 rotate-45 bg-gradient-to-r from-red-600 to-red-500 py-2 text-center shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-white drop-shadow-md">
                Esgotado
              </span>
            </div>
          </>
        )}

        <div className="relative z-[5] shrink-0">
          <Foto
            product={product}
            className={cn(
              "rounded-xl transition-transform group-hover:scale-[1.02]",
              variant === "vitrine"
                ? "aspect-square h-auto w-full"
                : variant === "promo"
                  ? "h-36 w-36"
                  : "h-28 w-28 sm:h-32 sm:w-32",
            )}
          />
        </div>

        <div className="relative z-[5] flex min-w-0 flex-1 flex-col">
          {variant === "promo" && (
            <div className="mb-1.5">
              <SeloPromo product={product} tag={destaqueTag} />
            </div>
          )}
          {variant === "lista" &&
            (product.tag ||
              (isDisponivel &&
                (product.freteGratis || hasProductPromo(product)))) && (
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                {product.tag && <TagBadge tag={product.tag} />}
                {product.freteGratis && isDisponivel && (
                  <FreteGratisBadge prazo={product.freteGratisPrazo} />
                )}
                {hasProductPromo(product) && isDisponivel && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#F1EAF8] px-2 py-1 text-[10px] font-semibold leading-none text-[#a82152]">
                    <BadgePercent
                      aria-hidden="true"
                      className="h-3 w-3"
                      strokeWidth={2.4}
                    />
                    Promoção
                  </span>
                )}
              </div>
            )}
          <h3
            className={cn(
              "line-clamp-2 text-[15px] font-medium leading-snug",
              isDisponivel ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {product.name}
          </h3>
          {variant !== "vitrine" && product.description && (
            <p
              className={cn(
                "mt-1.5 line-clamp-2 text-[13px] leading-snug",
                isDisponivel
                  ? "text-muted-foreground"
                  : "text-muted-foreground/70",
              )}
            >
              {product.description}
            </p>
          )}
          <div
            className={cn(
              "mt-auto",
              variant === "vitrine" ? "pt-2" : "pt-3",
              !isDisponivel && "opacity-70",
            )}
          >
            {variant === "promo" ? (
              <PrecoPromo product={product} />
            ) : (
              <PrecoProduto product={product} size="sm" />
            )}
          </div>
        </div>
      </article>
      {isDisponivel && open && (
        <ProductDetailDialog
          product={product}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
