"use client";

import { imageProxyUrl } from "@/lib/image/proxy-url";

/** Compatibility name: the stable app URL is available during render, without signing. */
export function useImagemAssinada(path: string | null | undefined): string | null {
  return imageProxyUrl(path);
}
