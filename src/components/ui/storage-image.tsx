"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { imageProxyUrl } from "@/lib/image/proxy-url";
import { imagePresets, type ImagePreset } from "@/lib/image/presets";

const FALLBACK = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="192" viewBox="0 0 320 192"><rect width="320" height="192" fill="#f3eff7"/><g stroke="#8c7a9f" stroke-width="3" fill="none"><rect x="140" y="76" width="40" height="40" rx="5"/><path d="m140 105 12-12 10 10 8-6 10 10"/><circle cx="169" cy="86" r="3"/></g></svg>');

/** Stable private-storage source + Next's on-demand variants, from a single original. */
export function StorageImage({ src, preset, sizes, quality, onError, ...props }: ImageProps & { preset?: ImagePreset }) {
  const source = typeof src === "string" ? imageProxyUrl(src) || FALLBACK : src;
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  const failed = failedSource === source;
  const hints = preset ? imagePresets[preset] : undefined;
  const responsiveSizes = sizes ?? hints?.sizes ?? (props.width ? `${Number(props.width)}px` : "100vw");

  return <NextImage
    {...props}
    // Product artwork is enlarged/cropped in the detail view: preserve the original pixels.
    unoptimized={props.unoptimized ?? preset === "productDetail"}
    src={failed ? FALLBACK : source}
    sizes={responsiveSizes}
    quality={quality ?? hints?.quality ?? 75}
    onError={event => {
      setFailedSource(source);
      onError?.(event);
    }}
  />;
}
