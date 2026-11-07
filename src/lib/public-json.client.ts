"use client";
const cache = new Map<string, { etag: string | null; data: unknown }>();
const pending = new Map<string, Promise<unknown>>();
export function readPublicJson<T>(url: string): Promise<T> {
  const existing = pending.get(url);
  if (existing) return existing as Promise<T>;
  const previous = cache.get(url);
  const request = fetch(url, {
    cache: "no-store",
    headers: previous?.etag ? { "If-None-Match": previous.etag } : {},
  })
    .then(async (response) => {
      if (response.status === 304 && previous) return previous.data;
      if (!response.ok)
        throw new Error("Não foi possível carregar os dados. Tente novamente.");
      const data: T = await response.json();
      cache.set(url, { etag: response.headers.get("etag"), data });
      return data;
    })
    .finally(() => {
      if (pending.get(url) === request) pending.delete(url);
    });
  pending.set(url, request);
  return request as Promise<T>;
}
