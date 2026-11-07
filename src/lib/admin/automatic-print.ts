export const PRINT_DEVICE_KEY = "donda-auto-print-device";
export const PRINT_DEVICE_EVENT = "donda-auto-print-device-change";
export const AUTOMATIC_PRINT_TYPE = "completo" as const;
const PRINTED_KEY = "donda-auto-print-sent";

export function setPrintDevice(enabled: boolean) {
  localStorage.setItem(PRINT_DEVICE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(PRINT_DEVICE_EVENT));
}

export function getSentOrders(): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(PRINTED_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function markOrderSent(id: string) {
  const entries = Object.entries({ ...getSentOrders(), [id]: Date.now() })
    .filter(([, time]) => Number.isFinite(time) && time > Date.now() - 7 * 86400_000)
    .sort((a, b) => b[1] - a[1]).slice(0, 1000);
  localStorage.setItem(PRINTED_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export async function withPrintLock(work: () => Promise<void>) {
  if (navigator.locks) {
    await navigator.locks.request("donda-auto-print", { ifAvailable: true }, async lock => { if (lock) await work(); });
    return;
  }
  // Older browsers: short renewable station lease; no persistent order data in it.
  const key = "donda-auto-print-lease", owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const previous = JSON.parse(localStorage.getItem(key) || "null");
  if (previous?.until > Date.now()) return;
  const renew = () => localStorage.setItem(key, JSON.stringify({ owner, until: Date.now() + 120_000 }));
  renew();
  await new Promise(resolve => setTimeout(resolve, 50));
  if (JSON.parse(localStorage.getItem(key) || "null")?.owner !== owner) return;
  const timer = setInterval(renew, 30_000);
  try { await work(); } finally {
    clearInterval(timer);
    if (JSON.parse(localStorage.getItem(key) || "null")?.owner === owner) localStorage.removeItem(key);
  }
}
