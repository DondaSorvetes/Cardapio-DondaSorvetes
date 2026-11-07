/**
 * Sanitização de entrada (XSS / injection de markup).
 * Remove tags HTML, protocolos perigosos e control chars.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Remove HTML e caracteres de controle */
export function stripHtml(input: string): string {
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/gi, "")
    .replace(/&gt;/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/** Texto de usuário (nome, observação, etc.) */
export function sanitizeText(input: unknown, maxLen = 500): string {
  if (input == null) return "";
  const s = stripHtml(String(input));
  return s.slice(0, maxLen);
}

/** Telefone: só dígitos */
export function sanitizePhone(input: unknown): string {
  return String(input ?? "")
    .replace(/\D/g, "")
    .slice(0, 15);
}

/** Path de storage: bloqueia traversal e caracteres estranhos */
export function sanitizeStoragePath(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const p = input.trim().replace(/\\/g, "/");
  if (p.includes("..") || p.startsWith("/") || p.includes("\0")) return null;
  if (!/^[a-zA-Z0-9_\-./\s]+$/.test(p)) return null;
  if (p.length > 512) return null;
  return p;
}

/** Extensões de imagem permitidas no storage */
export const ALLOWED_IMAGE_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
]);

export function isAllowedImagePath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_IMAGE_EXT.has(ext);
}

/** Only catalog namespaces may be served publicly, even when Storage is private. */
export function isPublicCatalogImagePath(path: string): boolean {
  return (
    /^(Produtos|Loja|configuracoes)\//.test(path) &&
    isAllowedImagePath(path)
  );
}
