const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  path = require("path"),
  ts = require("typescript"),
  { createRequire } = require("module");
function load(file, mocks = {}, globals = {}) {
  const exports = {},
    native = createRequire(path.resolve(file));
  new Function(
    "require",
    "exports",
    ...Object.keys(globals),
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
  )(
    (name) => (name in mocks ? mocks[name] : native(name)),
    exports,
    ...Object.values(globals),
  );
  return exports;
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function clock() {
  let now = 0,
    next = 0;
  const timers = new Map(),
    intervals = new Map();
  return {
    globals: {
      setTimeout: (fn, ms) => (timers.set(++next, { fn, at: now + ms }), next),
      clearTimeout: (id) => timers.delete(id),
      setInterval: (fn, ms) => (intervals.set(++next, { fn, ms }), next),
      clearInterval: (id) => intervals.delete(id),
      console: { debug() {} },
      crypto: require("crypto").webcrypto,
    },
    advance(ms) {
      now += ms;
      for (const [id, t] of [...timers])
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
    },
    timers,
    intervals,
  };
}
function fixture() {
  const c = clock();
  let creates = 0,
    channels = 0,
    removed = 0,
    disconnected = 0,
    status,
    payload,
    version = 1,
    reads = 0;
  const db = {
    channel() {
      channels++;
      return {
        on(_type, filter, fn) {
          assert.deepEqual(filter, {
            event: "*",
            schema: "public",
            table: "pedidos",
          });
          payload = fn;
          return this;
        },
        subscribe(fn) {
          status = fn;
          return this;
        },
      };
    },
    async removeChannel() {
      removed++;
    },
    realtime: {
      disconnect() {
        disconnected++;
      },
    },
    from() {
      return {
        select() {
          return this;
        },
        eq(key, owner) {
          assert.equal(key, "cliente_id");
          this.owner = owner;
          return this;
        },
        order() {
          return this;
        },
        async limit() {
          reads++;
          return {
            count: 1,
            data: [
              {
                id: this.owner + "-order",
                status: "preparando",
                updated_at: String(version),
              },
            ],
          };
        },
      };
    },
  };
  const { createOrderEventHub } = load(
    "src/lib/customer-order-hub.server.ts",
    {
      "server-only": {},
      "@/integrations/supabase/client.server": {
        createServiceRoleClient: () => db,
      },
    },
    c.globals,
  );
  const hub = createOrderEventHub(() => {
    creates++;
    return db;
  });
  return {
    c,
    hub,
    stats: () => ({ creates, channels, removed, disconnected, reads }),
    ready: () => status("SUBSCRIBED"),
    change: (owner, id = "one") => {
      version++;
      payload({
        eventType: "UPDATE",
        new: { cliente_id: owner, id, private: "never forward" },
      });
    },
    del: () =>
      payload({ eventType: "DELETE", old: { cliente_id: "A", id: "one" } }),
  };
}
test("three tabs and a different owner share one client/channel, isolate owners, debounce and release after grace", async () => {
  const h = fixture(),
    seen = [[], [], [], []],
    stops = [];
  for (let i = 0; i < 4; i++)
    stops.push(
      h.hub.subscribe(i === 3 ? "B" : "A", {
        ready() {},
        changed: (e) => seen[i].push(e),
        unavailable() {},
      }),
    );
  await tick();
  h.ready();
  assert.equal(h.stats().creates, 1);
  assert.equal(h.stats().channels, 1);
  assert.equal(h.hub.stats().subscribers, 4);
  h.change("A", "one");
  h.change("A", "two");
  h.change("B", "other");
  h.c.advance(100);
  await tick();
  assert.equal(h.stats().reads, 2);
  for (let i = 0; i < 3; i++) {
    assert.equal(seen[i].length, 1);
    assert.deepEqual(seen[i][0].ids, ["one", "two"]);
  }
  assert.deepEqual(seen[3][0].ids, ["other"]);
  h.del();
  h.c.advance(100);
  await tick();
  assert.equal(seen[0].length, 1);
  stops[0]();
  assert.equal(h.stats().disconnected, 0);
  stops.slice(1).forEach((fn) => fn());
  h.c.advance(29999);
  assert.equal(h.stats().removed, 0);
  h.c.advance(1);
  await tick();
  assert.equal(h.stats().removed, 1);
  assert.equal(h.stats().disconnected, 1);
});
test("SSE sends retry once, ready once, scoped changes then rotate; warm hub keeps one channel across rotation", async () => {
  const h = fixture();
  const { customerOrderEvents } = load(
    "src/lib/customer-order-events.server.ts",
    { "server-only": {} },
    h.c.globals,
  );
  const streams = Array.from({ length: 3 }, () =>
      customerOrderEvents(
        h.hub,
        "A",
        "",
        new AbortController().signal,
      ).body.getReader(),
    ),
    decode = new TextDecoder();
  for (const r of streams)
    assert.equal(decode.decode((await r.read()).value), "retry: 1000\n\n");
  await tick();
  h.ready();
  await tick();
  let version;
  for (const r of streams) {
    const ready = decode.decode((await r.read()).value);
    assert.match(ready, /event: ready/);
    version = ready.match(/id: (.+)\n/)[1];
  }
  h.change("A");
  h.c.advance(100);
  await tick();
  for (const r of streams) {
    const changed = decode.decode((await r.read()).value);
    assert.match(changed, /event: changed/);
    assert.ok(
      !changed.includes("ready") &&
        !changed.includes("retry:") &&
        !changed.includes("private"),
    );
    version = changed.match(/id: (.+)\n/)[1];
  }
  h.c.advance(279000);
  // Not rotated yet: no chunk may be pending before the lifetime elapses.
  const pending = streams.map((r) => r.read());
  for (const p of pending)
    assert.equal(await Promise.race([p.then(() => "chunk"), new Promise((ok) => setImmediate(() => ok("idle")))]), "idle");
  h.c.advance(1000);
  for (const [i, r] of streams.entries()) {
    assert.match(decode.decode((await pending[i]).value), /event: rotate/);
    assert.equal((await r.read()).done, true);
  }
  assert.equal(h.stats().removed, 0);
  const next = customerOrderEvents(
    h.hub,
    "A",
    version,
    new AbortController().signal,
  ).body.getReader();
  await next.read();
  await tick();
  const ready = decode.decode((await next.read()).value);
  assert.match(ready, /event: ready/);
  assert.ok(!ready.includes("changed"));
  assert.equal(h.stats().channels, 1);
  await next.cancel();
  h.c.advance(30000);
  await tick();
});
test("first snapshot waits for channel ready, catch-up is scoped and cancelling one stream keeps the other alive", async () => {
  const h = fixture();
  const { customerOrderEvents } = load(
    "src/lib/customer-order-events.server.ts",
    { "server-only": {} },
    h.c.globals,
  );
  const a = customerOrderEvents(
      h.hub,
      "A",
      "older",
      new AbortController().signal,
    ).body.getReader(),
    b = customerOrderEvents(
      h.hub,
      "B",
      "",
      new AbortController().signal,
    ).body.getReader();
  await a.read();
  await b.read();
  await tick();
  assert.equal(h.stats().reads, 0);
  h.ready();
  await tick();
  assert.match(new TextDecoder().decode((await a.read()).value), /catchup/);
  await a.read();
  await b.read();
  await a.cancel();
  assert.equal(h.hub.stats().subscribers, 1);
  h.change("B");
  h.c.advance(100);
  await tick();
  assert.match(new TextDecoder().decode((await b.read()).value), /changed/);
  await b.cancel();
  h.c.advance(30000);
  await tick();
});
test("client rotate preserves live lease; expired-cookie error stops retries; scoped event fetches only summary and affected detail", async () => {
  const c = clock(),
    bindings = [],
    requests = [],
    sources = [];
  let now = 100000,
    expired = 0;
  const doc = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      expired++;
    },
  };
  class ES {
    static CLOSED = 2;
    constructor(url) {
      this.url = url;
      this.handlers = {};
      sources.push(this);
    }
    addEventListener(name, fn) {
      this.handlers[name] = fn;
    }
    close() {
      this.readyState = 2;
    }
  }
  const api = load(
    "src/lib/customer-resource.ts",
    {
      react: {
        useCallback: (f) => f,
        useSyncExternalStore: (sub, get) => {
          bindings.push({ stop: sub(() => {}), get });
          return get();
        },
      },
    },
    {
      ...c.globals,
      document: doc,
      window: doc,
      EventSource: ES,
      Date: class extends Date {
        static now() {
          return now;
        }
      },
      fetch: (url, options) => {
        requests.push(url);
        if (url === "/api/auth/sessao")
          return Promise.resolve(new Response("", { status: 401 }));
        return Promise.resolve(
          Response.json(
            url.startsWith("/api/cliente/resumo")
              ? { count: 1, ativos: 1, updates: [] }
              : { pedido: { status: "pendente" }, pedidos: [] },
          ),
        );
      },
    },
  );
  api.setCustomerResourceIdentity("A");
  for (const url of [
    "/api/cliente/resumo",
    "/api/pedidos/listar?page=0",
    "/api/pedidos/detalhe?id=one",
    "/api/pedidos/detalhe?id=two",
  ])
    api.useCustomerResource("A", url);
  sources[0].handlers.ready({ data: '{"owner":"A"}', lastEventId: "v1" });
  await tick();
  const baseline = requests.length;
  now += 50000;
  sources[0].handlers.rotate();
  assert.equal(sources.length, 2);
  for (const t of c.intervals.values()) t.fn();
  await tick();
  assert.equal(requests.length, baseline);
  sources[1].handlers.ready({ data: '{"owner":"A"}', lastEventId: "v1" });
  sources[1].handlers.changed({
    data: '{"scope":"pedido","ids":["one"]}',
    lastEventId: "v2",
  });
  c.advance(300);
  await tick();
  const changed = requests.slice(baseline);
  assert.equal(changed.length, 2);
  assert.ok(
    changed.some((url) => url.startsWith("/api/cliente/resumo?ids=one")),
  );
  assert.ok(changed.includes("/api/pedidos/detalhe?id=one"));
  assert.ok(
    !changed.some((url) => url.includes("listar") || url.includes("two")),
  );
  sources[1].onerror();
  await tick();
  c.advance(60000);
  await tick();
  assert.equal(expired, 1);
  assert.equal(sources.length, 2);
  assert.equal(bindings[0].get().data, null);
});
test("event route has dedicated IP and owner buckets, and never opens hub for 401 or owner limit", async () => {
  let owner = null,
    hubCalls = 0,
    keys = [],
    limited = false;
  const rates = {
    eventos: { bucket: "events-ip", limit: 30, windowSec: 60 },
    eventosUsuario: { bucket: "events-owner", limit: 30, windowSec: 60 },
  };
  const api = load("src/app/api/pedidos/eventos/route.ts", {
    "@/lib/auth": { obterSessao: async () => (owner ? { id: owner } : null) },
    "@/lib/customer-order-hub.server": {
      getOrderEventHub: () => {
        hubCalls++;
        return {};
      },
    },
    "@/lib/customer-order-events.server": {
      customerOrderEvents: () => Response.json({}),
    },
    "@/lib/security/api-response": load("src/lib/security/api-response.ts"),
    "@/lib/security/rate-limit": {
      RATE_LIMITS: rates,
      rateLimitCheck: async (key, config) => {
        keys.push({ key, config });
        return {
          success: !limited,
          limit: 30,
          remaining: 0,
          reset: Date.now() + 60000,
        };
      },
      rateLimitHeaders: () => ({}),
    },
    "@/lib/security/with-api-guard": {
      withApiGuard: (options, fn) => {
        assert.equal(options.rateLimit, rates.eventos);
        return fn;
      },
    },
  });
  const request = new Request(
    "http://localhost/api/pedidos/eventos?cliente_id=forged",
  );
  assert.equal((await api.GET(request)).status, 401);
  assert.equal(hubCalls, 0);
  assert.equal(keys.length, 0);
  owner = "verified";
  limited = true;
  assert.equal((await api.GET(request)).status, 429);
  assert.equal(hubCalls, 0);
  assert.equal(keys[0].key, "verified");
  assert.equal(keys[0].config, rates.eventosUsuario);
  limited = false;
  assert.equal((await api.GET(request)).status, 200);
  assert.equal(hubCalls, 1);
});
test("unknown change scope safely invalidates history and all mounted details", async () => {
  const c = clock(),
    sources = [],
    requests = [];
  const doc = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  class ES {
    constructor() {
      sources.push(this);
      this.events = {};
    }
    addEventListener(k, fn) {
      this.events[k] = fn;
    }
    close() {}
  }
  const api = load(
    "src/lib/customer-resource.ts",
    {
      react: {
        useCallback: (f) => f,
        useSyncExternalStore: (sub, get) => {
          sub(() => {});
          return get();
        },
      },
    },
    {
      ...c.globals,
      document: doc,
      window: doc,
      EventSource: ES,
      fetch: async (url) => {
        requests.push(url);
        return Response.json({});
      },
    },
  );
  api.setCustomerResourceIdentity("A");
  api.useCustomerResource("A", "/api/pedidos/listar?page=0");
  api.useCustomerResource("A", "/api/pedidos/detalhe?id=other");
  sources[0].events.ready({ data: '{"owner":"A"}', lastEventId: "v1" });
  await tick();
  sources[0].events.changed({
    data: '{"scope":"unknown","ids":["one"]}',
    lastEventId: "v2",
  });
  c.advance(300);
  await tick();
  assert.equal(requests.length, 4);
  api.setCustomerResourceIdentity(null);
});
test("global hub survives module reloads without creating another singleton", () => {
  const sharedGlobal = {};
  const mocks = {
    "server-only": {},
    "@/integrations/supabase/client.server": {
      createServiceRoleClient: () => {
        throw new Error("must remain lazy");
      },
    },
  };
  const first = load("src/lib/customer-order-hub.server.ts", mocks, {
    globalThis: sharedGlobal,
  });
  const second = load("src/lib/customer-order-hub.server.ts", mocks, {
    globalThis: sharedGlobal,
  });
  assert.equal(first.getOrderEventHub(), second.getOrderEventHub());
  assert.deepEqual(first.getOrderEventHub().stats(), {
    owners: 0,
    subscribers: 0,
    channels: 0,
  });
});
test("events arriving during snapshot accumulate IDs and ready is emitted once", async () => {
  let subscriber, resolveSnapshot;
  const c = clock();
  const hub = {
    subscribe(owner, sub) {
      subscriber = sub;
      queueMicrotask(sub.ready);
      return () => {};
    },
    revision: () =>
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
    stats: () => ({ subscribers: 1, channels: 1 }),
  };
  const { customerOrderEvents } = load(
    "src/lib/customer-order-events.server.ts",
    { "server-only": {} },
    c.globals,
  );
  const reader = customerOrderEvents(
    hub,
    "A",
    "",
    new AbortController().signal,
  ).body.getReader();
  await reader.read();
  await tick();
  subscriber.changed({ ids: ["one"], version: "v1" });
  subscriber.changed({ ids: ["two"], version: "v2" });
  resolveSnapshot("base");
  await tick();
  const decoder = new TextDecoder(),
    changed = decoder.decode((await reader.read()).value),
    ready = decoder.decode((await reader.read()).value);
  assert.match(changed, /"ids":\["one","two"\]/);
  assert.match(ready, /id: v2\nevent: ready/);
  subscriber.ready();
  await tick();
  await reader.cancel();
});
test("summary status patches are bounded and filtered by the authenticated owner", async () => {
  const queries = [];
  const db = {
    from(table) {
      const q = { table, filters: [] };
      queries.push(q);
      const chain = {
        select(columns, options) {
          q.columns = columns;
          q.options = options;
          return chain;
        },
        eq(...args) {
          q.filters.push(args);
          return chain;
        },
        neq() {
          return chain;
        },
        not() {
          return chain;
        },
        in(column, values) {
          q.ids = values;
          return chain;
        },
        then(resolve) {
          return Promise.resolve({
            count: 2,
            data: q.ids
              ? [{ id: "one", status: "preparando", updated_at: "v2" }]
              : null,
            error: null,
          }).then(resolve);
        },
      };
      return chain;
    },
  };
  const api = load("src/app/api/cliente/resumo/route.ts", {
    "@/lib/auth": { obterSessao: async () => ({ id: "verified" }) },
    "@/integrations/supabase/client.server": { createServerClient: () => db },
    "@/lib/security/api-response": load("src/lib/security/api-response.ts"),
    "@/lib/security/with-api-guard": { withApiGuard: (options, fn) => fn },
    "@/lib/security/rate-limit": { RATE_LIMITS: { apiStrict: {} } },
  });
  const response = await api.GET(
    new Request(
      "http://localhost/api/cliente/resumo?ids=one,one,two&cliente_id=forged",
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(queries.length, 3);
  for (const q of queries)
    assert.deepEqual(q.filters, [["cliente_id", "verified"]]);
  assert.deepEqual(queries[2].ids, ["one", "two"]);
  assert.equal(queries[2].columns, "id,status,updated_at");
  assert.deepEqual((await response.json()).updates, [
    { id: "one", status: "preparando", updated_at: "v2" },
  ]);
});
