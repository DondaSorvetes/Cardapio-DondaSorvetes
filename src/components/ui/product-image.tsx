"use client";
import { StorageImage } from "./storage-image";
import type { ImageProps } from "next/image";
/** One candidate set for catalog cards, including combos reusing a product image. */
export function ProductImage(
  props: Omit<
    ImageProps,
    "width" | "height" | "sizes" | "quality" | "priority" | "loading" | "fill"
  >,
) {
  return (
    <StorageImage
      {...props}
      width={384}
      height={384}
      sizes="192px"
      quality={90}
      loading="lazy"
    />
  );
}
