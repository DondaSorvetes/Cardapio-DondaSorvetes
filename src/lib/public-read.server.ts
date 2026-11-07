import "server-only";
const pending = new Map<string, Promise<unknown>>();
/** Coalesces overlapping public reads only; no stale response cache. */
export function publicRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  const scoped = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") + ":" + key;
  const existing = pending.get(scoped);
  if (existing) return existing as Promise<T>;
  const request = read().finally(() => {
    if (pending.get(scoped) === request) pending.delete(scoped);
  });
  pending.set(scoped, request);
  return request;
}
export function invalidatePublicReads() {
  pending.clear();
}
