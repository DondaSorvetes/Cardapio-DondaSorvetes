/*
 * Service worker do app do painel no celular (PWA), escopo /admin.
 *
 * Existe para o app poder ser instalado, mostrar uma tela amigável sem internet
 * e exibir o aviso de pedido novo (Web Push). NUNCA guarda páginas ou dados do
 * painel em cache (pedidos, clientes): toda navegação vai para a rede; só a
 * página offline fica guardada.
 */
const CACHE = "donda-admin-v1";
const OFFLINE_URL = "/pwa/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/pwa/admin-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("donda-admin-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(
    fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
  );
});

/** Só abre telas do painel, nunca um endereço vindo de fora. */
function panelUrl(raw) {
  try {
    const url = new URL(typeof raw === "string" ? raw : "/admin/pedidos", self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith("/admin")) return url.href;
  } catch {
    /* cai no padrão abaixo */
  }
  return new URL("/admin/pedidos", self.location.origin).href;
}

// Pedido novo: o servidor manda { title, body, url, tag } (sem dados do cliente).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Novo pedido";
  const tag = typeof data.tag === "string" && data.tag ? data.tag : undefined;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "Abra o painel para ver.",
      icon: "/pwa/admin-192.png",
      // renotify sem tag é erro no Chrome (a notificação não aparece).
      ...(tag ? { tag, renotify: true } : {}),
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: panelUrl(data.url) },
    }),
  );
});

// Tocar no aviso: usa o app já aberto (se houver) e vai para o pedido.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = panelUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => new URL(client.url).pathname.startsWith("/admin"));
      if (open) {
        if ("navigate" in open) await open.navigate(url).catch(() => {});
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
