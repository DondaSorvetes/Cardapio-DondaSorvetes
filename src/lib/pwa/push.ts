/**
 * Inscrição do aparelho para receber aviso de pedido novo (Web Push).
 *
 * - Android/Chrome e computador: funciona no navegador ou no app instalado.
 * - iPhone/iPad (iOS 16.4+): só no app instalado pela Tela de Início.
 * O service worker do painel (/pwa/admin-sw.js) mostra a notificação.
 */
import { detectPlatform, isStandalone } from "./install";

export type PushSupport = "supported" | "needs-install" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  // O app do Windows não registra o service worker do painel.
  if ((window as Window & { dondaDesktop?: unknown }).dondaDesktop) return "unsupported";
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const hasApis =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (platform === "ios" && !isStandalone()) return "needs-install";
  return hasApis ? "supported" : "unsupported";
}

/** Chave pública VAPID (base64url) → bytes, como o PushManager pede. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/**
 * Service worker do painel. Na primeira visita ele ainda pode estar instalando:
 * espera alguns segundos. Sem registro (desenvolvimento, app do Windows), null.
 */
export async function panelRegistration(waitMs = 5000): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/admin");
  if (existing?.active) return existing;
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
  return ready ?? existing ?? null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await panelRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function sameKey(subscription: PushSubscription, key: Uint8Array) {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true; // navegador não informa: mantém
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((byte, i) => byte === key[i]);
}

/** Erro do navegador → mensagem em português com o que fazer. */
export function subscribeErrorMessage(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = String((error as { message?: string } | null)?.message ?? "");
  if (name === "NotAllowedError" || message === "PERMISSION_DENIED") return "PERMISSION_DENIED";
  if (name === "AbortError" || /push service/i.test(message))
    return (
      "O navegador não conseguiu falar com o serviço de notificações dele. " +
      "No Brave, ative “Usar os serviços do Google para mensagens push” em brave://settings/privacy. " +
      "Não funciona em aba anônima. No Android, use o Chrome (o celular precisa do Google Play). " +
      "Se a rede for de empresa/escola, teste no 4G."
    );
  if (name === "InvalidAccessError" || name === "InvalidStateError")
    return "A chave de notificação do servidor não foi aceita pelo navegador. Confira a NEXT_PUBLIC_VAPID_PUBLIC_KEY na Vercel.";
  return message || "Não foi possível ativar as notificações.";
}

/** Pede permissão (precisa vir de um toque da pessoa) e inscreve o aparelho. */
export async function subscribeDevice(publicKey: string): Promise<PushSubscription> {
  const registration = await panelRegistration();
  if (!registration) throw new Error("O app do painel ainda não terminou de carregar. Tente de novo em instantes.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("PERMISSION_DENIED");
  const key = urlBase64ToUint8Array(publicKey);
  const options = { userVisibleOnly: true, applicationServerKey: key as BufferSource };
  const existing = await registration.pushManager.getSubscription();
  // Inscrição feita com outra chave (tentativa anterior) não recebe nada: refaz.
  if (existing && sameKey(existing, key)) return existing;
  if (existing) await existing.unsubscribe().catch(() => {});
  try {
    return await registration.pushManager.subscribe(options);
  } catch (error) {
    // Uma nova tentativa limpa resolve o "push service error" passageiro.
    if ((error as { name?: string }).name !== "AbortError") throw error;
    await (await registration.pushManager.getSubscription())?.unsubscribe().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 800));
    return registration.pushManager.subscribe(options);
  }
}
