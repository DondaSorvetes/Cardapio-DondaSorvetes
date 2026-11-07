const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  ts = require("typescript"),
  path = require("path"),
  { createRequire } = require("module");
function load(file, mocks = {}, globals = {}) {
  const out = {},
    native = createRequire(path.resolve(file));
  new Function(
    "require",
    "exports",
    ...Object.keys(globals),
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
  )(
    (name) => (name in mocks ? mocks[name] : native(name)),
    out,
    ...Object.values(globals),
  );
  return out;
}
const tick = () => new Promise((r) => setImmediate(r));
function harness() {
  let now = 100_000,
    next = 0;
  const logs = [];
  const timers = new Map(),
    intervals = new Map(),
    requests = [],
    sources = [],
    bindings = [];
  const doc = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  };
  class Source {
    constructor(url) {
      this.url = url;
      this.events = {};
      sources.push(this);
    }
    addEventListener(n, f) {
      this.events[n] = f;
    }
    close() {
      this.closed = true;
    }
  }
  const api = load(
    "src/lib/customer-resource.ts",
    {
      react: {
        useCallback: (f) => f,
        useSyncExternalStore: (subscribe, get) => {
          const b = { subscribe, get, stop: subscribe(() => {}) };
          bindings.push(b);
          return get();
        },
      },
    },
    {
      console: { debug: (_tag, payload) => { if(payload.url) logs.push(payload); } },
      document: doc,
      window: doc,
      EventSource: Source,
      Date: class extends Date {
        static now() {
          return now;
        }
      },
      fetch: (url, opts) =>
        new Promise((resolve) => requests.push({ url, opts, resolve })),
      setTimeout: (fn, ms) => (timers.set(++next, { fn, at: now + ms }), next),
      clearTimeout: (id) => timers.delete(id),
      setInterval: (fn, ms) => (intervals.set(++next, { fn, ms }), next),
      clearInterval: (id) => intervals.delete(id),
    },
  );
  return {
    api,
    logs,
    doc,
    bindings,
    requests,
    sources,
    intervals,
    advance(ms) {
      now += ms;
      for (const [id, t] of [...timers])
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
    },
    ready() {
      sources.at(-1).events.ready({ data: '{"owner":"A"}', lastEventId: "v1" });
    },
    async resolve(index, data, status = 200) {
      requests[index].resolve(Response.json(data, { status }));
      await tick();
    },
  };
}
test("live store reuses data beyond 30 seconds, retains ten minutes and survives reader gaps", async () => {
  const h = harness();
  h.api.setCustomerResourceIdentity("A");
  h.api.useCustomerResource("A", "/api/pedidos/listar?page=0");
  h.ready();
  await h.resolve(0, { pedidos: [] });
  h.bindings[0].stop();
  h.advance(1000);
  h.api.useCustomerResource("A", "/api/pedidos/listar?page=0");
  assert.equal(h.sources.length, 1);
  h.advance(120000);
  h.bindings[1].stop();
  h.api.useCustomerResource("A", "/api/pedidos/listar?page=0");
  assert.equal(h.requests.length, 1);
  assert.equal(h.bindings.at(-1).get().loading, false);
  assert.equal(h.intervals.size, 0);
  h.api.setCustomerResourceIdentity(null);
});
test("a consumer mounted before identity attaches when identity arrives", async () => {
  const h = harness();
  h.api.useCustomerResource("A", "/api/cliente/resumo");
  assert.equal(h.requests.length, 0);
  h.api.setCustomerResourceIdentity("A");
  assert.equal(h.requests.length, 1);
  await h.resolve(0, { count: 3, ativos: 1 });
  assert.equal(h.bindings[0].get().data.count, 3);
  h.api.setCustomerResourceIdentity(null);
});
test("scoped bursts revalidate one order while preserving old content and coalesce in-flight invalidations", async () => {
  const h = harness();
  h.api.setCustomerResourceIdentity("A");
  for (const id of ["one", "two"])
    h.api.useCustomerResource("A", "/api/pedidos/detalhe?id=" + id);
  h.ready();
  await h.resolve(0, { pedido: { status: "pendente" } });
  await h.resolve(1, { pedido: { status: "pendente" } });
  const source = h.sources[0];
  source.events.changed({ data: '{"scope":"pedido","ids":["one"]}', lastEventId: "v2" });
  source.events.changed({ data: '{"scope":"pedido","ids":["one"]}', lastEventId: "v2" });
  h.advance(300);
  assert.equal(h.requests.length, 3);
  assert.equal(h.bindings[0].get().data.pedido.status, "pendente");
  assert.equal(h.bindings[0].get().loading, false);
  assert.equal(h.requests[2].url, "/api/pedidos/detalhe?id=one");
  h.api.invalidateCustomerResources({ id: "one", version: "v3" });
  h.api.invalidateCustomerResources({ id: "one", version: "v4" });
  await h.resolve(2, { pedido: { status: "preparando" } });
  assert.equal(h.requests.length, 4);
  await h.resolve(3, { pedido: { status: "entregue" } });
  h.api.setCustomerResourceIdentity(null);
});
test("403 and 404 messages survive without generic catch overwriting them", async () => {
  for (const [status, message] of [
    [403, "Você não tem permissão"],
    [404, "Pedido não encontrado"],
  ]) {
    const h = harness();
    h.api.setCustomerResourceIdentity("A");
    h.api.useCustomerResource("A", "/api/pedidos/detalhe?id=one");
    await h.resolve(0, {}, status);
    assert.match(h.bindings[0].get().error, new RegExp(message));
    h.api.setCustomerResourceIdentity(null);
  }
});
test("versioned image conditional GET performs zero Storage reads; invalid paths remain denied", async () => {
  const policy = load("src/lib/image/cache-policy.ts"),
    sanitize = load("src/lib/security/sanitize.ts");
  let reads = 0;
  const api = load("src/app/api/imagem/arquivo/route.ts", {
    "@/lib/image/cache-policy": policy,
    "@/lib/image/source.server": {
      readStorageImage: async () => {
        reads++;
        return {
          bytes: new Uint8Array([1, 2]).buffer,
          type: "image/webp",
          etag: '"legacy"',
        };
      },
    },
    "@/lib/security/with-api-guard": { withApiGuard: (_o, f) => f },
    "@/lib/security/rate-limit": { RATE_LIMITS: { imagem: {} } },
    "@/lib/security/api-response": load("src/lib/security/api-response.ts"),
    "@/lib/security/sanitize": sanitize,
  });
  const request = (p, etag) => ({
    nextUrl: new URL(
      "https://store.test/api/imagem/arquivo?" +
        new URLSearchParams({ path: p }),
    ),
    headers: new Headers(etag ? { "If-None-Match": etag } : {}),
  });
  const first = await api.GET(
    request("Produtos/Agua_Mineral-1793350000000.PNG"),
  );
  assert.equal(first.status, 200);
  assert.match(first.headers.get("cache-control"), /immutable/);
  const second = await api.GET(
    request(
      "Produtos/Agua_Mineral-1793350000000.PNG",
      first.headers.get("etag"),
    ),
  );
  assert.equal(second.status, 304);
  assert.equal(reads, 1);
  console.log(
    "Conditional immutable image: Storage calls for 304 =",
    reads - 1,
  );
  const denied = await api.GET(
    request("documentos/private-1793350000000.png", first.headers.get("etag")),
  );
  assert.equal(denied.status, 400);
  assert.equal(reads, 1);
  const legacy = await api.GET(request("Produtos/legacy.webp", '"legacy"'));
  assert.equal(legacy.status, 304);
  assert.equal(reads, 2);
});
test("bounded source LRU reuses bytes, evicts old originals and does not retain huge files", async () => {
  let calls = 0;
  const policy = load("src/lib/image/cache-policy.ts");
  const download = async (p) => {
    calls++;
    return {
      data: new Blob(
        [new Uint8Array(p.includes("huge") ? 9 * 1024 * 1024 : 1024 * 1024)],
        { type: "image/webp" },
      ),
    };
  };
  const db = { storage: { from: () => ({ download }) } };
  const api = load("src/lib/image/source.server.ts", {
    "server-only": {},
    "./cache-policy": policy,
    "@/integrations/supabase/client.server": { createServerClient: () => db },
  });
  await api.readStorageImage("DondaSorvetes", "Produtos/one.webp");
  await api.readStorageImage("DondaSorvetes", "Produtos/one.webp");
  assert.equal(calls, 1);
  for (let i = 0; i < 33; i++)
    await api.readStorageImage("DondaSorvetes", "Produtos/" + i + ".webp");
  const before = calls;
  await api.readStorageImage("DondaSorvetes", "Produtos/one.webp");
  assert.equal(calls, before + 1);
  await api.readStorageImage("DondaSorvetes", "Produtos/huge.webp");
  await api.readStorageImage("DondaSorvetes", "Produtos/huge.webp");
  assert.equal(calls, before + 3);
});
test("summary validates identity once and scopes both counts to that identity", async () => {
  let sessions = 0;
  const filters = [];
  const db = {
    from() {
      return {
        select() {
          return this;
        },
        eq(key, value) {
          filters.push([key, value]);
          return this;
        },
        neq() {
          return Promise.resolve({ count: 8 });
        },
        not() {
          return Promise.resolve({ count: 2 });
        },
      };
    },
  };
  const api = load("src/app/api/cliente/resumo/route.ts", {
    "@/lib/auth": {
      obterSessao: async () => {
        sessions++;
        return { id: "verified" };
      },
    },
    "@/integrations/supabase/client.server": { createServerClient: () => db },
    "@/lib/security/api-response": load("src/lib/security/api-response.ts"),
    "@/lib/security/with-api-guard": { withApiGuard: (_o, f) => f },
    "@/lib/security/rate-limit": { RATE_LIMITS: { apiStrict: {} } },
  });
  const res = await api.GET(new Request("http://localhost/api/cliente/resumo"));
  assert.deepEqual(await res.json(), { count: 8, ativos: 2, updates: [] });
  assert.equal(sessions, 1);
  assert.deepEqual(filters, [
    ["cliente_id", "verified"],
    ["cliente_id", "verified"],
  ]);
  assert.match(res.headers.get("cache-control"), /private, no-store/);
});
test("combo option batch fetches four tables once and validates unavailable products per combo", async () => {
  const tables = {
    produtos: [
      { id: 1, nome: "Açaí", esta_disponivel: true },
      { id: 2, nome: "Água", esta_disponivel: false },
    ],
    produto_grupos: [{ produto_id: 1, grupo_id: 10 }],
    grupos_opcoes: [{ id: 10, nome: "Sabor", min_escolha: 1, max_escolha: 1 }],
    opcoes: [{ id: 20, grupo_id: 10, nome: "Tradicional", preco_adicional: 0 }],
  };
  const calls = [];
  const db = {
    from(t) {
      calls.push(t);
      const q = {
        select() {
          return q;
        },
        in() {
          return q;
        },
        order() {
          return q;
        },
        then(resolve) {
          return Promise.resolve({ data: tables[t] }).then(resolve);
        },
      };
      return q;
    },
  };
  const { createComboOptionLoader } = load("src/lib/combos/options.ts");
  const build = await createComboOptionLoader(db, [1, 2, 1]);
  assert.equal(build([{ produto_id: 1, quantidade: 2 }]).length, 2);
  assert.throws(
    () => build([{ produto_id: 2, quantidade: 1 }]),
    /não está disponível/,
  );
  assert.equal(calls.length, 4);
});
test("ProductImage generates identical responsive candidates for product and combo cards", () => {
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server");
  const { ProductImage } = load("src/components/ui/product-image.tsx", {
    "./storage-image": {
      StorageImage: (props) =>
        React.createElement("img", {
          "data-width": props.width,
          "data-sizes": props.sizes,
          "data-quality": props.quality,
          src: props.src,
        }),
    },
  });
  const a = renderToStaticMarkup(
      React.createElement(ProductImage, { src: "/same.webp", alt: "A" }),
    ),
    b = renderToStaticMarkup(
      React.createElement(ProductImage, { src: "/same.webp", alt: "Combo" }),
    );
  assert.equal(a, b);
  assert.match(a, /data-sizes="192px"/);
});

test('unchanged stream renewal preserves freshness and backoff is not bypassed by remounts',async()=>{
 const h=harness();h.api.setCustomerResourceIdentity('A');h.api.useCustomerResource('A','/api/cliente/resumo');h.ready();await h.resolve(0,{count:1,ativos:1});
 h.advance(60000);h.sources[0].events.rotate();h.advance(1000);assert.equal(h.sources.length,2);h.ready();h.advance(60000);h.bindings[0].stop();h.api.useCustomerResource('A','/api/cliente/resumo');assert.equal(h.requests.length,1);
 h.sources[1].onerror();h.bindings[1].stop();h.api.useCustomerResource('A','/api/cliente/resumo');assert.equal(h.sources.length,2,'remount must not skip scheduled backoff');h.api.setCustomerResourceIdentity(null);
});

test('requested navigation sequence logs only one mount per shared resource',async()=>{
 const h=harness();h.api.setCustomerResourceIdentity('A');h.api.useCustomerResource('A','/api/cliente/resumo');h.ready();await h.resolve(0,{count:4,ativos:1});
 h.api.useCustomerResource('A','/api/pedidos/listar?page=0');await h.resolve(1,{pedidos:[],hasMore:false});h.bindings[1].stop();h.advance(32000);
 h.api.useCustomerResource('A','/api/pedidos/listar?page=0');h.bindings[2].stop();h.api.useCustomerResource('A','/api/cliente/resumo');h.bindings[3].stop();
 assert.equal(h.requests.length,2);assert.deepEqual(h.logs.map(({url,reason,count})=>({url,reason,count})),[{url:'/api/cliente/resumo',reason:'mount',count:1},{url:'/api/pedidos/listar?page=0',reason:'mount',count:1}]);
 if(process.env.CACHE_REFINEMENT_REPORT)fs.writeFileSync(process.env.CACHE_REFINEMENT_REPORT,JSON.stringify(h.logs,null,2));h.api.setCustomerResourceIdentity(null);
});
