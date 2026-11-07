const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const out = ts.transpileModule(fs.readFileSync(path.resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", out)((n) => (n in mocks ? mocks[n] : require(n)), mod, mod.exports);
  return mod.exports;
}

test("admin manifest is installable and stays inside /admin", () => {
  const m = JSON.parse(fs.readFileSync("public/pwa/admin.webmanifest", "utf8"));
  assert.equal(m.display, "standalone");
  assert.equal(m.scope, "/admin");
  for (const url of [m.start_url, m.id, ...m.shortcuts.map((s) => s.url)]) assert.ok(url.startsWith(m.scope), url);
  const sizes = m.icons.map((i) => `${i.sizes}:${i.purpose}`);
  assert.ok(sizes.includes("192x192:any") && sizes.includes("512x512:any") && sizes.includes("512x512:maskable"));
  for (const icon of m.icons) {
    const png = fs.readFileSync(path.join("public", icon.src));
    assert.equal(png.readUInt32BE(16), Number(icon.sizes.split("x")[0]), `${icon.src} width`);
    assert.equal(png.readUInt32BE(20), Number(icon.sizes.split("x")[1]), `${icon.src} height`);
  }
});

test("service worker never caches panel data, only the offline page", async () => {
  const src = fs.readFileSync("public/pwa/admin-sw.js", "utf8");
  const handlers = {};
  const cached = [];
  const self = { addEventListener: (name, fn) => (handlers[name] = fn), skipWaiting: async () => {}, clients: { claim: async () => {} } };
  const caches = {
    open: async () => ({ addAll: async (urls) => cached.push(...urls) }),
    keys: async () => [],
    match: async (url) => (url === "/pwa/offline.html" ? "OFFLINE" : undefined),
  };
  let networkOk = true;
  const fetch = async () => { if (!networkOk) throw new Error("offline"); return "NETWORK"; };
  new Function("self", "caches", "fetch", "Response", src)(self, caches, fetch, { error: () => "ERROR" });
  let waited;
  handlers.install({ waitUntil: (p) => (waited = p) });
  await waited;
  assert.deepEqual(cached.sort(), ["/pwa/admin-192.png", "/pwa/offline.html"]);
  assert.doesNotMatch(src, /cache\.put|\.put\(/, "no runtime caching");

  let responded = null;
  handlers.fetch({ request: { mode: "cors", method: "GET" }, respondWith: (r) => (responded = r) });
  assert.equal(responded, null, "API/data requests are not intercepted");
  handlers.fetch({ request: { mode: "navigate", method: "GET" }, respondWith: (r) => (responded = r) });
  assert.equal(await responded, "NETWORK");
  networkOk = false;
  handlers.fetch({ request: { mode: "navigate", method: "GET" }, respondWith: (r) => (responded = r) });
  assert.equal(await responded, "OFFLINE");
});

test("manifest, iPhone icon and worker scope are wired for every /admin page", () => {
  const layout = fs.readFileSync("src/app/admin/layout.tsx", "utf8");
  assert.match(layout, /manifest: "\/pwa\/admin\.webmanifest"/);
  assert.match(layout, /admin-apple-180\.png/);
  assert.match(layout, /viewportFit: "cover"/);
  const config = fs.readFileSync("next.config.ts", "utf8");
  assert.match(config, /source: "\/pwa\/admin-sw\.js"[\s\S]*?Service-Worker-Allowed", value: "\/admin"/);
  const pwa = fs.readFileSync("src/components/admin/pwa/AdminPwa.tsx", "utf8");
  assert.match(pwa, /register\("\/pwa\/admin-sw\.js", \{ scope: "\/admin" \}\)/);
  assert.match(pwa, /dondaDesktop/, "not registered inside the Windows app");
  // Fora de /admin, para o middleware não redirecionar o manifesto para o login.
  assert.ok(!"/pwa/admin.webmanifest".startsWith("/admin"));
});

test("install helpers detect iPhone, iPad and Android", () => {
  const install = load("src/lib/pwa/install.ts");
  assert.equal(install.detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "ios");
  assert.equal(install.detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "ios");
  assert.equal(install.detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "desktop");
  assert.equal(install.detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), "android");
});

test("bottom bar shows up to 4 shortcuts the user can access, in priority order", () => {
  const items = [
    ["/admin", "dashboard"], ["/admin/pedidos", "pedidos"], ["/admin/produtos", "catalogo"], ["/admin/cupons", "cupons"],
    ["/admin/clientes", "clientes"], ["/admin/relatorios", "relatorios"], ["/admin/estabelecimento", "estabelecimento"], ["/admin/configuracoes", "configuracoes"],
  ].map(([href, access]) => ({ href, access, label: href, icon: () => null }));
  const stub = { menuItems: items, pathIsActive: () => false };
  const nav = load("src/components/admin/premium/MobileBottomNav.tsx", {
    "./PremiumSidebar": stub, "next/link": () => null, "next/navigation": { usePathname: () => "/admin" },
    "lucide-react": { Menu: () => null }, "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" ") },
  });
  const hrefs = (acessos) => nav.pickShortcuts(acessos).map((i) => i.href);
  assert.deepEqual(hrefs(items.map((i) => i.access)), ["/admin", "/admin/pedidos", "/admin/produtos", "/admin/clientes"]);
  assert.deepEqual(hrefs(["pedidos"]), ["/admin/pedidos"], "attendant only sees what they can open");
  assert.deepEqual(hrefs(["pedidos", "estabelecimento", "configuracoes"]), ["/admin/pedidos", "/admin/estabelecimento", "/admin/configuracoes"]);
  const css = fs.readFileSync("src/components/admin/premium/admin-responsive.css", "utf8");
  assert.match(css, /\.admin-workspace \{ height: calc\(100dvh - var\(--admin-toolbar-height\) - var\(--admin-bottom-nav\)\)/);
});
