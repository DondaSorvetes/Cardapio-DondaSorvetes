const STORAGE_BUCKETS = new Set(["DondaSorvetes"]);

/** Replaces a Supabase storage URL or path with an app-owned image endpoint. */
export function imageProxyUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  // Already stable, local, or client-only: never wrap these a second time.
  if (value.startsWith("/api/imagem/arquivo?") || /^(?:data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("/api/imagem?")) return value;
  if (value.startsWith("/api/imagem?")) {
    const query = new URLSearchParams(value.split("?")[1]);
    const path = query.get("path");
    if (!path) return value;
    return `/api/imagem/arquivo?${new URLSearchParams({ bucket: "DondaSorvetes", path })}`;
  }

  let bucket = "DondaSorvetes";
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(
        /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/
      );
      if (!match) return value;
      bucket = decodeURIComponent(match[1]);
      path = decodeURIComponent(match[2]);
    } catch {
      return value;
    }
  }

  if (!STORAGE_BUCKETS.has(bucket)) return value;
  const params = new URLSearchParams({ bucket, path });
  return `/api/imagem/arquivo?${params.toString()}`;
}
