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

/** Pede permissão (precisa vir de um toque da pessoa) e inscreve o aparelho. */
export async function subscribeDevice(publicKey: string): Promise<PushSubscription> {
  const registration = await panelRegistration();
  if (!registration) throw new Error("O app do painel ainda não terminou de carregar. Tente de novo em instantes.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("PERMISSION_DENIED");
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
}
