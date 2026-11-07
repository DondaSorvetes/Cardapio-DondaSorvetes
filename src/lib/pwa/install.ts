/**
 * Instalação do painel como app no celular (PWA).
 *
 * O Android/Chrome dispara "beforeinstallprompt" uma vez, cedo, quando o app pode ser
 * instalado: o evento é guardado aqui (registrado no layout do admin) para o botão
 * "Instalar" usar depois, em qualquer tela. No iPhone não existe esse evento: a
 * instalação é pelo menu Compartilhar → "Adicionar à Tela de Início".
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallPlatform = "ios" | "android" | "desktop";
export type InstallState = {
  platform: InstallPlatform;
  /** Já está aberto como app instalado. */
  standalone: boolean;
  /** Android/Chrome liberou o botão Instalar. */
  canPrompt: boolean;
  installed: boolean;
};

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  // iPadOS se identifica como Mac: diferencia pelo toque.
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getInstallState(): InstallState {
  return {
    platform: typeof navigator === "undefined" ? "desktop" : detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    standalone: isStandalone(),
    canPrompt: deferred !== null,
    installed,
  };
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Abre o convite de instalação do Android. Devolve true se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

/** Script inline do layout: guarda o convite se ele vier antes da hidratação. */
export const EARLY_CAPTURE_SCRIPT =
  "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__dondaInstall=e;});";

let started = false;
/** Chamado uma vez no layout do admin. */
export function startInstallTracking() {
  if (started || typeof window === "undefined") return;
  started = true;
  // Evento que chegou antes de o React montar (capturado por EARLY_CAPTURE_SCRIPT).
  const early = (window as Window & { __dondaInstall?: InstallPromptEvent }).__dondaInstall;
  if (early) {
    deferred = early;
    notify();
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}
