"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { requireAdminApi } from "@/lib/admin/auth";
import { hasPageAccess } from "@/lib/security/rbac";
import { getClientIp, rateLimitCheck } from "@/lib/security/rate-limit";
import { isAllowedPushEndpoint } from "@/lib/push/pedido-push";
import { notifyTest, pushSetupStatus } from "@/lib/push/pedido-push.server";

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(1000)
    .refine(isAllowedPushEndpoint, "Serviço de notificação não suportado."),
  keys: z.object({
    p256dh: z.string().min(16).max(200).regex(/^[A-Za-z0-9_-]+=*$/),
    auth: z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+=*$/),
  }),
});

/** Só quem vê Pedidos recebe aviso de pedido novo. */
async function requireOrdersAccess() {
  const session = await requireAdminApi();
  if (!hasPageAccess(session.acessos, "pedidos")) throw new Error("FORBIDDEN");
  return session;
}

async function throttle(bucket: string, limit: number) {
  const incoming = await headers();
  const result = await rateLimitCheck(
    getClientIp(new Request("http://localhost", { headers: incoming })),
    { bucket, limit, windowSec: 60 },
  );
  if (!result.success) throw new Error("Aguarde um momento antes de tentar novamente.");
}

/** Chave pública em tempo de execução + o que falta configurar (nomes, nunca valores). */
export async function getPushStatus() {
  await requireOrdersAccess();
  return pushSetupStatus();
}

export async function savePushSubscription(input: unknown) {
  const session = await requireOrdersAccess();
  await throttle("admin:push-save", 20);
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) throw new Error("Não foi possível ativar as notificações neste aparelho.");
  const incoming = await headers();
  const { endpoint, keys } = parsed.data;
  // Mesmo aparelho com outra conta: a inscrição passa para quem entrou agora.
  const { error } = await createServiceRoleClient()
    .from("admin_push_subscriptions")
    .upsert(
      {
        user_id: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: incoming.get("user-agent")?.slice(0, 300) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) throw new Error("Não foi possível salvar a inscrição de notificações.");
  return { ok: true };
}

export async function removePushSubscription(endpoint: unknown) {
  const session = await requireAdminApi();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: true };
  await createServiceRoleClient()
    .from("admin_push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", session.user.id);
  return { ok: true };
}

export async function sendTestPush() {
  const session = await requireOrdersAccess();
  await throttle("admin:push-test", 5);
  return notifyTest(session.user.id);
}
