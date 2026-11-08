/**
 * Aviso de pedido novo no celular da equipe (Web Push). Funções puras: o envio
 * de verdade (web-push + Supabase) é ligado em pedido-push.server.ts.
 */
import { shortOrderId } from "@/components/admin/pedidos/order-status";

export type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type NewOrderPush = {
  title: string;
  body: string;
  /** Sempre dentro de /admin: o service worker só abre URLs do painel. */
  url: string;
  /** Mesmo pedido não empilha duas notificações. */
  tag: string;
};

/**
 * Serviços de push dos navegadores (Chrome/Android, Firefox, Safari/iPhone, Edge).
 * O servidor faz POST no endpoint informado pelo aparelho: aceitar qualquer URL
 * permitiria usar o servidor para chamar endereços internos.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.port === "" || url.port === "443") &&
      PUSH_HOSTS.some((host) => host.test(url.hostname))
    );
  } catch {
    return false;
  }
}

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/**
 * Texto da notificação. Aparece na tela bloqueada: sem nome, telefone ou
 * endereço do cliente, só número, valor e tipo do pedido.
 */
export function buildNewOrderPush(pedido: {
  id: string;
  total: number | string | null;
  tipo_entrega?: string | null;
  agendado_para?: string | null;
}): NewOrderPush {
  const numero = shortOrderId(String(pedido.id));
  let tipo = pedido.tipo_entrega === "retirada" ? "Retirada" : "Entrega";
  if (pedido.tipo_entrega === "retirada" && pedido.agendado_para) {
    const hora = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(pedido.agendado_para));
    tipo = `Retirada agendada para ${hora}`;
  }
  return {
    title: `Novo pedido #${numero}`,
    body: `${money(Number(pedido.total) || 0)} · ${tipo}`,
    url: `/admin/pedidos?pedido=${encodeURIComponent(String(pedido.id))}`,
    tag: `pedido-${pedido.id}`,
  };
}

export type PushDeps = {
  /** Inscrições candidatas (todas, ou só as de um usuário). */
  listSubscriptions: () => Promise<PushSubscriptionRow[]>;
  /** Dos usuários informados, quais ainda podem ver Pedidos. */
  allowedUsers: (userIds: string[]) => Promise<Set<string>>;
  /** Envia; erro com statusCode 404/410 = inscrição expirada. */
  send: (subscription: PushSubscriptionRow, payload: string) => Promise<unknown>;
  /** Apaga inscrições expiradas. */
  removeEndpoints: (endpoints: string[]) => Promise<void>;
};

export async function sendPush(payload: NewOrderPush, deps: PushDeps) {
  const subscriptions = (await deps.listSubscriptions()).filter((s) =>
    isAllowedPushEndpoint(s.endpoint),
  );
  if (!subscriptions.length) return { sent: 0, removed: 0, failed: 0 };
  const allowed = await deps.allowedUsers([
    ...new Set(subscriptions.map((s) => s.user_id)),
  ]);
  const targets = subscriptions.filter((s) => allowed.has(s.user_id));
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(targets.map((s) => deps.send(s, body)));
  const expired: string[] = [];
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") return;
    const status = (result.reason as { statusCode?: number } | null)?.statusCode;
    if (status === 404 || status === 410) expired.push(targets[index].endpoint);
    else failed++;
  });
  if (expired.length) await deps.removeEndpoints(expired);
  return { sent: targets.length - expired.length - failed, removed: expired.length, failed };
}
