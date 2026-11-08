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

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

/** Tira espaços e aspas que costumam vir junto ao colar o valor no painel da Vercel. */
const clean = (value: string | undefined) =>
  value?.trim().replace(/^(["'])(.*)\1$/, "$2").trim() || undefined;

/**
 * Lê as chaves VAPID em tempo de execução e diz o que está errado (só nomes de
 * variáveis, nunca valores). Aceita VAPID_PUBLIC_KEY como nome alternativo.
 */
export function readVapidConfig(env: Record<string, string | undefined>): {
  config: VapidConfig | null;
  problems: string[];
} {
  const publicKey = clean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) ?? clean(env.VAPID_PUBLIC_KEY);
  const privateKey = clean(env.VAPID_PRIVATE_KEY);
  const subject = clean(env.VAPID_SUBJECT);
  const problems: string[] = [];
  if (!publicKey) problems.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY não encontrada");
  // Pública: ponto P-256 sem compressão (65 bytes → 87 caracteres base64url).
  else if (!/^[A-Za-z0-9_-]{86,88}={0,2}$/.test(publicKey))
    problems.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY não parece a chave pública (Public Key)");
  if (!privateKey) problems.push("VAPID_PRIVATE_KEY não encontrada");
  // Privada: 32 bytes → 43 caracteres base64url.
  else if (!/^[A-Za-z0-9_-]{42,44}={0,1}$/.test(privateKey))
    problems.push("VAPID_PRIVATE_KEY não parece a chave privada (Private Key)");
  if (publicKey && privateKey && publicKey === privateKey)
    problems.push("as duas chaves estão iguais");
  if (!subject) problems.push("VAPID_SUBJECT não encontrada");
  else if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject))
    problems.push("VAPID_SUBJECT precisa começar com mailto: (ex.: mailto:contato@loja.com)");
  return {
    config: problems.length ? null : { publicKey: publicKey!, privateKey: privateKey!, subject: subject! },
    problems,
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
