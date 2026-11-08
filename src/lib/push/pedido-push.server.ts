import "server-only";
import webpush from "web-push";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { resolveAcessos, resolveAdminRole } from "@/lib/security/rbac";
import {
  buildNewOrderPush,
  sendPush,
  type NewOrderPush,
  type PushDeps,
} from "./pedido-push";

/**
 * Chaves VAPID (geradas uma vez com `npx web-push generate-vapid-keys`):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  pública, vai para o navegador
 *   VAPID_PRIVATE_KEY             secreta, só no servidor
 *   VAPID_SUBJECT                 contato do remetente, ex.: mailto:contato@loja.com
 * Sem elas, nada é enviado e o painel mostra que as notificações não estão ativas.
 */
function vapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function pushConfigured() {
  return vapid() !== null;
}

function deps(onlyUserId?: string): PushDeps {
  const details = vapid()!;
  const db = createServiceRoleClient();
  return {
    async listSubscriptions() {
      let query = db
        .from("admin_push_subscriptions")
        .select("user_id, endpoint, p256dh, auth");
      if (onlyUserId) query = query.eq("user_id", onlyUserId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    // Mesma regra do painel (getAdminUser): quem perdeu acesso a Pedidos para de receber.
    async allowedUsers(userIds) {
      const { data, error } = await db
        .from("perfis")
        .select("id, role, acessos")
        .in("id", userIds);
      if (error) throw error;
      return new Set(
        (data ?? [])
          .filter((p) =>
            resolveAcessos(resolveAdminRole(p.role), p.acessos).includes("pedidos"),
          )
          .map((p) => p.id),
      );
    },
    send(subscription, payload) {
      return webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        {
          vapidDetails: details,
          // Pedido velho não interessa: o aviso some se o celular ficar 1h offline.
          TTL: 60 * 60,
          urgency: "high",
          timeout: 5000,
        },
      );
    },
    async removeEndpoints(endpoints) {
      await db.from("admin_push_subscriptions").delete().in("endpoint", endpoints);
    },
  };
}

/** Avisa a equipe de um pedido novo. Nunca lança: falha de aviso não afeta o pedido. */
export async function notifyNewOrder(pedido: Parameters<typeof buildNewOrderPush>[0]) {
  if (!pushConfigured()) return;
  try {
    const result = await sendPush(buildNewOrderPush(pedido), deps());
    if (result.failed) console.warn("[push] avisos não entregues:", result.failed);
  } catch (error) {
    console.warn("[push] não foi possível avisar a equipe:", (error as Error)?.message);
  }
}

/** Notificação de teste só para os aparelhos de quem pediu. */
export async function notifyTest(userId: string) {
  if (!pushConfigured()) return { sent: 0, removed: 0, failed: 0 };
  const payload: NewOrderPush = {
    title: "Notificações ativadas",
    body: "É assim que os pedidos novos vão aparecer neste celular.",
    url: "/admin/pedidos",
    tag: "teste",
  };
  return sendPush(payload, deps(userId));
}
