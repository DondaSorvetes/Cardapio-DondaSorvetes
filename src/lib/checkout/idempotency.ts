import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
export function checkoutIdentity(header: string | null, body: unknown) {
  if (process.env.CHECKOUT_IDEMPOTENCY_ENABLED !== "true") return null;
  if (!header || !/^[a-zA-Z0-9_-]{16,100}$/.test(header))
    throw new Error("Chave de pedido inválida. Tente novamente.");
  return {
    key: header,
    hash: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
  };
}
export async function previousCheckout(
  client: SupabaseClient,
  clientId: string,
  identity: { key: string; hash: string },
) {
  const { data, error } = await client
    .from("pedidos")
    .select(
      "id,status,total,desconto_cupom,cupom_codigo,created_at,idempotency_hash",
    )
    .eq("cliente_id", clientId)
    .eq("idempotency_key", identity.key)
    .maybeSingle();
  if (error)
    throw new Error(
      "Não foi possível confirmar o pedido anterior. Tente novamente.",
    );
  if (!data) return null;
  if (data.idempotency_hash !== identity.hash)
    throw new Error(
      "Esta tentativa pertence a outra sacola. Confira seus pedidos.",
    );
  const { idempotency_hash: _hash, ...pedido } = data;
  void _hash;
  return pedido;
}
