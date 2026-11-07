import "server-only";
import { invalidatePublicReads } from "@/lib/public-read.server";
import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

const TABLES = new Set([
  "produtos",
  "categorias",
  "combos",
  "combo_itens",
  "tags",
  "promocoes_frete_gratis",
  "configuracoes_loja",
  "produto_opcoes",
  "opcoes",
  "grupos_opcoes",
  "produto_grupos",
]);

export function isCatalogMutation(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const method = (
    init?.method || (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) return false;
  const url = new URL(input instanceof Request ? input.url : String(input));
  return TABLES.has(url.pathname.match(/^\/rest\/v1\/([^/]+)$/)?.[1] || "");
}

async function notifyCatalogChanged() {
  try {
    revalidateTag("public-catalog");
    revalidatePath("/");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    // Public invalidation only: no rows, customer information or credentials in the payload.
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: "public-catalog",
            event: "changed",
            payload: {},
            private: false,
          },
        ],
      }),
    });
    if (!response.ok)
      console.warn("[catalog] Não foi possível enviar o aviso de atualização.");
  } catch {
    console.warn(
      "[catalog] Atualização será recuperada pela sincronização periódica.",
    );
  }
}

/** Runs after successful persisted writes; never delays or fails a saved admin change. */
export const catalogFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.ok && isCatalogMutation(input, init)) {
    invalidatePublicReads();
    try {
      revalidateTag("public-catalog");
    } catch {
      /* Maintenance scripts have no request context. */
    }
    try {
      after(notifyCatalogChanged);
    } catch {
      /* Non-request maintenance scripts have no Next.js lifecycle. */
    }
  }
  return response;
};
