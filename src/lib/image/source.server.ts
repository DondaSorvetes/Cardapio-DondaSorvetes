import "server-only";
import { createHash } from "node:crypto";
import { createServerClient } from "@/integrations/supabase/client.server";
import { imageCacheSeconds } from "./cache-policy";

type Source = { bytes: ArrayBuffer; type: string; etag: string };
const MAX_CACHE_BYTES = 32 * 1024 * 1024,
  MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const cache = new Map<string, { source: Source; expires: number }>();
let cacheBytes = 0;
function forget(key: string) {
  const old = cache.get(key);
  if (old) cacheBytes -= old.source.bytes.byteLength;
  cache.delete(key);
}
const pending = new Map<string, Promise<Source | null>>();

/** Deduplicate variants and bound hot original bytes; persistent cache stays in Next. */
export function readStorageImage(
  bucket: string,
  path: string,
): Promise<Source | null> {
  const key = JSON.stringify([bucket, path]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve(cached.source);
  }
  if (cached) forget(key);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const options = {
      cache: "force-cache" as RequestCache,
      next: { revalidate: imageCacheSeconds(path) },
    };
    if (process.env.NODE_ENV !== "production")
      console.debug("[image-source]", { path, reason: "storage-miss" });
    const { data, error } = await createServerClient()
      .storage.from(bucket)
      .download(path, {}, options);
    if (error || !data) return null;
    const bytes = await data.arrayBuffer();
    const source = {
      bytes,
      type: data.type || "application/octet-stream",
      etag: `"${createHash("sha256").update(new Uint8Array(bytes)).digest("hex")}"`,
    };
    if (bytes.byteLength <= MAX_ENTRY_BYTES) {
      while (
        cache.size >= 64 ||
        cacheBytes + bytes.byteLength > MAX_CACHE_BYTES
      ) {
        const oldest = cache.keys().next().value;
        if (!oldest) break;
        forget(oldest);
      }
      cache.set(key, {
        source,
        expires: Date.now() + Math.min(imageCacheSeconds(path) * 1000, 300_000),
      });
      cacheBytes += bytes.byteLength;
    }
    return source;
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
