/*
 * Service worker do app do painel no celular (PWA), escopo /admin.
 *
 * Só existe para o app poder ser instalado e mostrar uma tela amigável sem
 * internet. NUNCA guarda páginas ou dados do painel em cache (pedidos, clientes):
 * toda navegação vai para a rede; só a página offline fica guardada.
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
