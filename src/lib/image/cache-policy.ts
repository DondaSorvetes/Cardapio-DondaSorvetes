/** Only existing public catalog namespaces qualify; legacy mutable names stay short-lived. */
export function isImmutableImagePath(path: string) {
  return /^(?:Produtos|Loja|configuracoes)\/[\w.-]+-\d{13}\.(?:webp|png|jpe?g)$/i.test(
    path,
  );
}
export function imageCacheControl(path: string) {
  return isImmutableImagePath(path)
    ? "public, max-age=31536000, s-maxage=31536000, immutable"
    : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
}
export function imageCacheSeconds(path: string) {
  return isImmutableImagePath(path) ? 31536000 : 3600;
}
