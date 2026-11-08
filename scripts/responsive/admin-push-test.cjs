/**
 * Aviso de pedido novo (Web Push): texto sem dados do cliente, só serviços de
 * push conhecidos, só quem vê Pedidos recebe, inscrições expiradas são apagadas
 * e o service worker só abre telas do painel.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const out = ts.transpileModule(fs.readFileSync(path.resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", out)((n) => (n in mocks ? mocks[n] : require(n)), mod, mod.exports);
  return mod.exports;
}
const orderStatus = load("src/components/admin/pedidos/order-status.ts");
const push = load("src/lib/push/pedido-push.ts", { "@/components/admin/pedidos/order-status": orderStatus });
const ID = "7f3c2a10-0000-4000-8000-000000004321";

test("texto da notificação: número, valor e tipo, sem nome/telefone/endereço do cliente", () => {
  const entrega = push.buildNewOrderPush({ id: ID, total: 45.9, tipo_entrega: "entrega", cliente_nome: "Maria", cliente_telefone: "17999990000" });
  assert.equal(entrega.title, "Novo pedido #4321");
  assert.match(entrega.body, /^R\$\s?45,90 · Entrega$/);
  assert.equal(entrega.url, `/admin/pedidos?pedido=${ID}`);
  assert.equal(entrega.tag, `pedido-${ID}`);
  assert.doesNotMatch(JSON.stringify(entrega), /Maria|17999990000/);
  const agendada = push.buildNewOrderPush({ id: ID, total: "20", tipo_entrega: "retirada", agendado_para: "2026-11-08T17:30:00.000Z" });
  assert.match(agendada.body, /Retirada agendada para 14:30$/, "horário de Brasília");
  assert.match(push.buildNewOrderPush({ id: ID, total: null, tipo_entrega: "retirada" }).body, /0,00 · Retirada$/);
});

test("só endpoints dos serviços de push dos navegadores são aceitos", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/QGx",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ]) assert.equal(push.isAllowedPushEndpoint(ok), true, ok);
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://localhost/push",
    "https://169.254.169.254/latest",
    "https://evil.com/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.com/x",
    "https://user:pass@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "não é url",
  ]) assert.equal(push.isAllowedPushEndpoint(bad), false, bad);
});

test("envia só para quem vê Pedidos e apaga inscrições expiradas", async () => {
  const subs = [
    { user_id: "atendente", endpoint: "https://fcm.googleapis.com/a", p256dh: "k", auth: "a" },
    { user_id: "atendente", endpoint: "https://web.push.apple.com/expirada", p256dh: "k", auth: "a" },
    { user_id: "sem-acesso", endpoint: "https://fcm.googleapis.com/b", p256dh: "k", auth: "a" },
    { user_id: "atendente", endpoint: "https://interno.local/x", p256dh: "k", auth: "a" },
    { user_id: "gerente", endpoint: "https://fcm.googleapis.com/falha", p256dh: "k", auth: "a" },
  ];
  const sent = [];
  let removed = [];
  let askedUsers;
  const result = await push.sendPush(push.buildNewOrderPush({ id: ID, total: 10 }), {
    listSubscriptions: async () => subs,
    allowedUsers: async (ids) => ((askedUsers = ids), new Set(["atendente", "gerente"])),
    send: async (sub, body) => {
      sent.push(sub.endpoint);
      assert.equal(JSON.parse(body).title, "Novo pedido #4321");
      if (sub.endpoint.endsWith("expirada")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (sub.endpoint.endsWith("falha")) throw Object.assign(new Error("timeout"), { statusCode: 500 });
    },
    removeEndpoints: async (endpoints) => (removed = endpoints),
  });
  assert.deepEqual(askedUsers.sort(), ["atendente", "gerente", "sem-acesso"]);
  assert.deepEqual(sent.sort(), ["https://fcm.googleapis.com/a", "https://fcm.googleapis.com/falha", "https://web.push.apple.com/expirada"]);
  assert.deepEqual(removed, ["https://web.push.apple.com/expirada"]);
  assert.deepEqual(result, { sent: 1, removed: 1, failed: 1 });

  let called = false;
  const none = await push.sendPush(push.buildNewOrderPush({ id: ID, total: 1 }), {
    listSubscriptions: async () => [],
    allowedUsers: async () => ((called = true), new Set()),
    send: async () => {},
    removeEndpoints: async () => {},
  });
  assert.deepEqual(none, { sent: 0, removed: 0, failed: 0 });
  assert.equal(called, false, "sem inscrições não consulta perfis");
});

function worker() {
  const handlers = {};
  const shown = [];
  const opened = [];
  const windows = [];
  const self = {
    location: { origin: "https://loja.test" },
    addEventListener: (name, fn) => (handlers[name] = fn),
    skipWaiting: async () => {},
    registration: { showNotification: async (title, options) => shown.push({ title, options }) },
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url) => opened.push(url),
    },
  };
  const src = fs.readFileSync("public/pwa/admin-sw.js", "utf8");
  new Function("self", "caches", "fetch", "Response", src)(self, {}, async () => {}, {});
  const run = async (name, event) => {
    let waited;
    handlers[name]({ ...event, waitUntil: (p) => (waited = p) });
    await waited;
  };
  return { run, shown, opened, windows };
}

test("service worker mostra o aviso e cai num texto padrão com payload inválido", async () => {
  const sw = worker();
  const payload = push.buildNewOrderPush({ id: ID, total: 12 });
  await sw.run("push", { data: { json: () => payload } });
  assert.equal(sw.shown[0].title, "Novo pedido #4321");
  assert.equal(sw.shown[0].options.tag, `pedido-${ID}`);
  assert.equal(sw.shown[0].options.renotify, true);
  assert.equal(sw.shown[0].options.data.url, `https://loja.test/admin/pedidos?pedido=${ID}`);

  await sw.run("push", { data: { json: () => { throw new Error("não é JSON"); } } });
  assert.equal(sw.shown[1].title, "Novo pedido");
  assert.equal("renotify" in sw.shown[1].options, false, "renotify sem tag quebra no Chrome");
  assert.equal(sw.shown[1].options.data.url, "https://loja.test/admin/pedidos");
});

test("tocar no aviso abre só telas do painel, reaproveitando o app aberto", async () => {
  const sw = worker();
  const click = (url) => ({ notification: { close() {}, data: { url } } });
  await sw.run("notificationclick", click("https://evil.example/phish"));
  await sw.run("notificationclick", click("/perfil"));
  await sw.run("notificationclick", click(`/admin/pedidos?pedido=${ID}`));
  assert.deepEqual(sw.opened, [
    "https://loja.test/admin/pedidos",
    "https://loja.test/admin/pedidos",
    `https://loja.test/admin/pedidos?pedido=${ID}`,
  ]);
  const visited = [];
  let focused = false;
  sw.windows.push({ url: "https://loja.test/admin", navigate: async (url) => visited.push(url), focus: async () => (focused = true) });
  await sw.run("notificationclick", click("/admin/pedidos"));
  assert.deepEqual(visited, ["https://loja.test/admin/pedidos"]);
  assert.equal(focused, true);
  assert.equal(sw.opened.length, 3, "não abre outra janela");
});

test("chave pública VAPID vira os bytes que o navegador espera", () => {
  const { urlBase64ToUint8Array } = load("src/lib/pwa/push.ts", { "./install": {} });
  const bytes = Uint8Array.from({ length: 65 }, (_, i) => (i * 37) % 256);
  const key = Buffer.from(bytes).toString("base64url");
  assert.deepEqual([...urlBase64ToUint8Array(key)], [...bytes]);
});

test("chaves VAPID lidas em tempo de execução: aceita colagem com aspas/espaços e aponta o que falta", () => {
  const { publicKey, privateKey } = require("web-push").generateVAPIDKeys(); // descartáveis, só para o teste
  const ok = push.readVapidConfig({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: ` "${publicKey}" `,
    VAPID_PRIVATE_KEY: `${privateKey}\n`,
    VAPID_SUBJECT: "'mailto:contato@loja.com'",
  });
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.config, { publicKey, privateKey, subject: "mailto:contato@loja.com" });
  assert.equal(push.readVapidConfig({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "https://loja.com" }).config?.publicKey, publicKey, "nome alternativo");

  assert.deepEqual(push.readVapidConfig({}).problems, [
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY não encontrada",
    "VAPID_PRIVATE_KEY não encontrada",
    "VAPID_SUBJECT não encontrada",
  ]);
  const trocadas = push.readVapidConfig({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: privateKey, VAPID_PRIVATE_KEY: publicKey, VAPID_SUBJECT: "contato@loja.com" });
  assert.equal(trocadas.config, null);
  assert.deepEqual(trocadas.problems, [
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY não parece a chave pública (Public Key)",
    "VAPID_PRIVATE_KEY não parece a chave privada (Private Key)",
    "VAPID_SUBJECT precisa começar com mailto: (ex.: mailto:contato@loja.com)",
  ]);
  for (const problem of trocadas.problems) assert.ok(!problem.includes(publicKey) && !problem.includes(privateKey), "nunca expõe valores");
});

test("erros do navegador ao ativar viram mensagens em português com o que fazer", () => {
  const { subscribeErrorMessage } = load("src/lib/pwa/push.ts", { "./install": {} });
  const abort = Object.assign(new Error("Registration failed - push service error"), { name: "AbortError" });
  assert.match(subscribeErrorMessage(abort), /Brave.*brave:\/\/settings\/privacy/s);
  assert.match(subscribeErrorMessage(new Error("Registration failed - push service error")), /serviço de notificações/);
  assert.equal(subscribeErrorMessage(Object.assign(new Error("x"), { name: "NotAllowedError" })), "PERMISSION_DENIED");
  assert.match(subscribeErrorMessage(Object.assign(new Error("x"), { name: "InvalidAccessError" })), /NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
});

test("inscrição antiga com outra chave é refeita; 'push service error' tenta de novo uma vez", async () => {
  const push2 = load("src/lib/pwa/push.ts", { "./install": {} });
  const { publicKey } = require("web-push").generateVAPIDKeys();
  const outraChave = new Uint8Array(65).fill(7).buffer;
  const calls = [];
  let existing = { options: { applicationServerKey: outraChave }, unsubscribe: async () => (calls.push("unsubscribe"), (existing = null), true) };
  let falhas = 1;
  const fresh = { endpoint: "https://fcm.googleapis.com/novo" };
  const registration = {
    active: {},
    pushManager: {
      getSubscription: async () => existing,
      subscribe: async (opts) => {
        calls.push("subscribe");
        assert.equal(opts.userVisibleOnly, true);
        if (falhas-- > 0) throw Object.assign(new Error("Registration failed - push service error"), { name: "AbortError" });
        return fresh;
      },
    },
  };
  const navDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { serviceWorker: { getRegistration: async () => registration, ready: Promise.resolve(registration) } }, configurable: true, writable: true });
  global.Notification = { requestPermission: async () => "granted" };
  try {
    assert.equal(await push2.subscribeDevice(publicKey), fresh);
    assert.deepEqual(calls, ["unsubscribe", "subscribe", "subscribe"]);
  } finally {
    if (navDesc) Object.defineProperty(globalThis, "navigator", navDesc); else delete globalThis.navigator;
    delete global.Notification;
  }
});
