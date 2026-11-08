import { catalogFetch } from "@/lib/catalog-fetch.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const BUCKET = "DondaSorvetes";
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hora em segundos

/**
 * Cliente Supabase com Service Role (chave secreta)
 * Use para operações que precisam de acesso total ao banco
 * NÃO use para verificar sessões de usuário
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "[security] NEXT_PUBLIC_SUPABASE_URL não configurada"
    );
  }

  // Prefer service role no servidor; se ausente, anon (com RLS)
  const keyToUse = serviceKey || anonKey;
  if (!keyToUse) {
    throw new Error(
      "[security] SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY obrigatória"
    );
  }

  if (process.env.NODE_ENV === "production" && !serviceKey) {
    console.warn(
      "[security] SUPABASE_SERVICE_ROLE_KEY ausente em produção — usando anon key"
    );
  }

  return createClient<Database>(url, keyToUse, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: catalogFetch },
  });
}

// Backwards compatibility for existing customer-facing code
export function createServerClient() {
  return createServiceRoleClient();
}

/**
 * Gera uma signed URL para um path no bucket privado.
 * Deve ser chamada APENAS no servidor.
 */
export async function getSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;

  const client = createServiceRoleClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error) {
    console.error("[getSignedUrl] erro:", error.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Gera signed URLs em lote para múltiplos paths.
 * Muito mais eficiente que chamar getSignedUrl em loop.
 */
export async function getSignedUrls(
  paths: string[],
): Promise<Map<string, string>> {
  const validPaths = paths.filter(Boolean);
  if (validPaths.length === 0) return new Map();

  const client = createServiceRoleClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrls(validPaths, SIGNED_URL_EXPIRY);

  if (error) {
    console.error("[getSignedUrls] erro:", error.message);
    return new Map();
  }

  return new Map(
    (data ?? [])
      .filter((item) => item.signedUrl && item.path)
      .map((item) => [item.path!, item.signedUrl!]),
  );
}
