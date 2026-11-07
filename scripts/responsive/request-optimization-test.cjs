const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  ts = require("typescript"),
  path = require("path"),
  { createRequire } = require("module");
function load(file, mocks = {}, globals = {}) {
  const native = createRequire(path.resolve(file)),
    out = {};
  new Function(
    "require",
    "exports",
    ...Object.keys(globals),
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
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
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("public ETags avoid unchanged payloads and change when prices change", async () => {
  const api = load("src/lib/public-json.server.ts");
  const req = { headers: new Headers() };
  const first = api.publicJson(req, { price: 20 });
  assert.equal(first.status, 200);
  req.headers.set("if-none-match", first.headers.get("etag"));
  const same = api.publicJson(req, { price: 20 });
  assert.equal(same.status, 304);
  assert.equal(await same.text(), "");
  assert.equal(api.publicJson(req, { price: 21 }).status, 200);
  assert.match(first.headers.get("cache-control"), /max-age=0/);
});
test("public concurrent reads share work, invalidation prevents joining an old read, failures retry", async () => {
  const api = load("src/lib/public-read.server.ts", { "server-only": {} });
  let finish,
    calls = 0;
  const read = () => {
    calls++;
    return new Promise((resolve) => (finish = resolve));
  };
  const a = api.publicRead("menu", read),
    b = api.publicRead("menu", read);
  assert.equal(a, b);
  assert.equal(calls, 1);
  api.invalidatePublicReads();
  const c = api.publicRead("menu", async () => {
    calls++;
    return "new";
  });
  finish("old");
  assert.equal(await a, "old");
  assert.equal(await c, "new");
  assert.equal(calls, 2);
  await assert.rejects(
    api.publicRead("bad", async () => {
      throw Error("offline");
    }),
  );
  assert.equal(await api.publicRead("bad", async () => 7), 7);
});
test("conditional client reads deduplicate and retain the same object on 304", async () => {
  let calls = 0;
  const api = load(
    "src/lib/public-json.client.ts",
    {},
    {
      fetch: async (_url, init) => {
        calls++;
        return calls === 1
          ? new Response('{"categorias":[]}', { headers: { etag: '"v1"' } })
          : (assert.equal(init.headers["If-None-Match"], '"v1"'),
            new Response(null, { status: 304 }));
      },
    },
  );
  const [a, b] = await Promise.all([
    api.readPublicJson("/api/cardapio"),
    api.readPublicJson("/api/cardapio"),
  ]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(await api.readPublicJson("/api/cardapio"), a);
});
test("private shared reads cancel and discard late customer A responses after switching to B", async () => {
  const subscriptions = [],
    requests = [],
    intervals = new Map(),
    timeouts = new Map();
  let n = 0;
  const target = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  const api = load(
    "src/lib/customer-resource.ts",
    {
      react: {
        useCallback: (f) => f,
        useSyncExternalStore: (subscribe, getSnapshot) => {
          subscriptions.push({ stop: subscribe(() => {}), getSnapshot });
          return getSnapshot();
        },
      },
    },
    {
      document: target,
      window: target,
      setInterval: (f) => {
        intervals.set(++n, f);
        return n;
      },
      clearInterval: (id) => intervals.delete(id),
      setTimeout: (f) => {
        timeouts.set(++n, f);
        return n;
      },
      clearTimeout: (id) => timeouts.delete(id),
      fetch: (url, init) =>
        new Promise((resolve) => requests.push({ url, init, resolve })),
    },
  );
  api.setCustomerResourceIdentity("A");
  api.useCustomerResource("A", "/api/pedidos/listar");
  api.useCustomerResource("A", "/api/pedidos/listar");
  assert.equal(requests.length, 1);
  assert.equal(intervals.size, 1);
  api.setCustomerResourceIdentity("B");
  assert.ok(requests[0].init.signal.aborted);
  assert.equal(intervals.size, 0);
  api.useCustomerResource("B", "/api/pedidos/listar");
  requests[0].resolve(Response.json({ pedidos: ["private-A"] }));
  requests[1].resolve(Response.json({ pedidos: ["B"] }));
  await tick();
  await tick();
  assert.equal(subscriptions[0].getSnapshot().data, null);
  assert.deepEqual(subscriptions[2].getSnapshot().data, { pedidos: ["B"] });
  target.visibilityState = "hidden";
  for (const timer of intervals.values()) timer();
  assert.equal(requests.length, 2);
  api.setCustomerResourceIdentity(null);
  assert.equal(subscriptions[2].getSnapshot().data, null);
  assert.equal(intervals.size, 0);
  subscriptions.forEach((s) => s.stop());
});
const row = {
  id: "own",
  status: "preparando",
  created_at: "2026-11-02T12:00:00Z",
  updated_at: "2026-11-02T12:00:00Z",
  total: 20,
  cliente_nome: "Private",
  cliente_telefone: "secret",
  itens: [
    {
      qty: 1,
      produto: {
        name: "Açaí",
        image: "/a.webp",
        optionGroups: [{ large: "unused" }],
      },
      adicionais: [{ name: "Granola", price: 1 }],
      selections: { 1: ["2"] },
    },
  ],
};
test("order summaries exclude private fields and nested product/options snapshots", () => {
  const { resumirPedido } = load("src/lib/customer-order-summary.ts");
  const summary = resumirPedido({
    ...row,
    produto_nome: row.itens[0].produto.name,
    produto_imagem: row.itens[0].produto.image,
  });
  assert.equal(summary.itens[0].produto.name, "Açaí");
  assert.ok(!JSON.stringify(summary).includes("secret"));
  assert.ok(!JSON.stringify(summary).includes("adicionais"));
  assert.ok(!JSON.stringify(summary).includes("optionGroups"));
});
test("customer list, detail and count authorize by server session; detail avoids option queries for named snapshots", async () => {
  let session = { id: "verified-user" },
    queries = [];
  const db = {
    from(table) {
      const q = { table, filters: [] };
      queries.push(q);
      const chain = {
        select: (cols) => ((q.columns = cols), chain),
        eq: (key, value) => (q.filters.push([key, value]), chain),
        neq: () => chain,
        order: () => chain,
        range: (a, b) => ((q.range = [a, b]), chain),
        maybeSingle: async () => ({ data: row }),
        then: (resolve) =>
          Promise.resolve({ data: [row], count: 1 }).then(resolve),
      };
      return chain;
    },
  };
  const mocks = {
    "@/lib/security/with-api-guard": { withApiGuard: (_opts, fn) => fn },
    "@/lib/security/rate-limit": { RATE_LIMITS: { apiStrict: {} } },
    "@/lib/auth": { obterSessao: async () => session },
    "@/integrations/supabase/client.server": { createServerClient: () => db },
    "@/lib/security/api-response": load("src/lib/security/api-response.ts"),
    "@/lib/customer-order-summary": load("src/lib/customer-order-summary.ts"),
    "@/lib/utils/pedido": load("src/lib/utils/pedido.ts"),
    "@/lib/entregadores": load("src/lib/entregadores.ts"),
  };
  for (const route of ["listar", "detalhe", "contagem"]) {
    queries = [];
    const api = load("src/app/api/pedidos/" + route + "/route.ts", mocks);
    const result = await api.GET(
      new Request(
        "http://localhost/api/pedidos/" +
          route +
          "?id=own&cliente_id=attacker&page=1",
      ),
    );
    assert.equal(result.status, 200);
    assert.deepEqual(queries[0].filters[0], ["cliente_id", "verified-user"]);
    assert.equal(queries.length, 1);
    assert.match(result.headers.get("cache-control"), /private, no-store/);
    if (route === "listar") {
      assert.deepEqual(queries[0].range, [20, 40]);
      assert.ok(
        queries[0].columns.includes("produto_nome:itens->0->produto->>name"),
      );
      assert.ok(
        !queries[0].columns
          .split(",")
          .map((s) => s.trim())
          .includes("itens"),
      );
    }
  }
  session = null;
  queries = [];
  const detail = load("src/app/api/pedidos/detalhe/route.ts", mocks);
  assert.equal(
    (await detail.GET(new Request("http://localhost/?id=own"))).status,
    401,
  );
  assert.equal(queries.length, 0);
});
test("admin recovery replays concurrent events, duplicate inserts notify once and cleanup stops recovery", async () => {
  const states = [],
    effects = [],
    timers = new Map(),
    handlers = {},
    reads = [];
  let status,
    notifications = 0,
    sounds = 0,
    index = 0,
    removed = 0,
    next = 0;
  const react = {
    useState: (initial) => {
      const i = index++;
      states[i] = typeof initial === "function" ? initial() : initial;
      return [
        states[i],
        (value) => {
          states[i] = typeof value === "function" ? value(states[i]) : value;
        },
      ];
    },
    useRef: (initial) => ({ current: initial }),
    useCallback: (f) => f,
    useEffect: (fn) => effects.push(fn),
  };
  const target = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  const channel = {
    on(_type, filter, fn) {
      handlers[filter.event] = fn;
      return this;
    },
    subscribe(fn) {
      status = fn;
      return this;
    },
  };
  const api = load(
    "src/hooks/usePedidosRealtime.ts",
    {
      react,
      "@/lib/supabase/client": {
        createClient: () => ({
          channel: () => channel,
          removeChannel: async () => removed++,
        }),
      },
      "@/actions/admin/pedidos": {
        listPedidosAdmin: () => new Promise((resolve) => reads.push(resolve)),
      },
      "@/lib/admin/order-alert-sound": { playNewOrderSound: () => sounds++ },
      sonner: { toast: { success: () => notifications++ } },
    },
    {
      document: target,
      window: target,
      crypto: require("crypto").webcrypto,
      setTimeout: (fn) => {
        timers.set(++next, fn);
        return next;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  api.usePedidosRealtime([
    { id: "initial", status: "pendente", created_at: "2026-11-01T12:00:00Z" },
  ]);
  const cleanup = effects[0]();
  const flush = () => {
    for (const [id, fn] of [...timers]) {
      timers.delete(id);
      fn();
    }
  };
  status("SUBSCRIBED");
  flush();
  assert.equal(reads.length, 1);
  const incoming = {
    id: "new",
    status: "pendente",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  handlers.INSERT({ new: incoming });
  handlers.INSERT({ new: incoming });
  assert.equal(sounds, 1);
  assert.equal(notifications, 1);
  handlers.UPDATE({ new: { ...incoming, status: "preparando" } });
  handlers.DELETE({ old: { id: "initial" } });
  reads[0]([{ id: "initial", status: "pendente" }, incoming]);
  await tick();
  assert.equal(states[0].length, 1);
  assert.equal(states[0][0].status, "preparando");
  assert.equal(sounds, 1);
  status("SUBSCRIBED");
  flush();
  assert.equal(reads.length, 2);
  cleanup();
  reads[1]([]);
  await tick();
  assert.equal(states[0].length, 1);
  assert.equal(removed, 1);
  assert.equal(timers.size, 0);
});
test("a private response from a different cookie identity is discarded before rendering", async () => {
  let finish,
    snapshot,
    eventCount = 0;
  const target = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      eventCount++;
    },
  };
  const api = load(
    "src/lib/customer-resource.ts",
    {
      react: {
        useCallback: (f) => f,
        useSyncExternalStore: (subscribe, get) => {
          subscribe(() => {});
          snapshot = get;
          return get();
        },
      },
    },
    {
      document: target,
      window: target,
      fetch: () => new Promise((resolve) => (finish = resolve)),
      setInterval: () => 1,
      clearInterval() {},
      setTimeout: () => 1,
      clearTimeout() {},
    },
  );
  api.setCustomerResourceIdentity("A");
  api.useCustomerResource("A", "/api/pedidos/listar");
  finish(
    Response.json(
      { pedidos: ["B private data"] },
      { headers: { "X-Customer-Id": "B" } },
    ),
  );
  await tick();
  assert.equal(snapshot().data, null);
  assert.equal(eventCount, 1);
});
test("an updated list invalidates an older cached detail but preserves a matching detail", async () => {
  const requests = [];
  let snapshot;
  const target = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  const api = load(
    "src/lib/customer-resource.ts",
    {
      react: {
        useCallback: (f) => f,
        useSyncExternalStore: (subscribe, get) => {
          subscribe(() => {});
          snapshot = get;
          return get();
        },
      },
    },
    {
      document: target,
      window: target,
      fetch: () => new Promise((resolve) => requests.push(resolve)),
      setInterval: () => 1,
      clearInterval() {},
      setTimeout: () => 1,
      clearTimeout() {},
    },
  );
  api.setCustomerResourceIdentity("A");
  api.useCustomerResource("A", "/api/pedidos/detalhe?id=order");
  requests[0](
    Response.json({ pedido: { status: "pendente", updated_at: "v1" } }),
  );
  await tick();
  api.invalidateCustomerOrderDetail("A", "order", "pendente:v1");
  assert.equal(requests.length, 1);
  api.invalidateCustomerOrderDetail("A", "order", "preparando:v2");
  assert.equal(requests.length, 2);
  assert.equal(snapshot().data.pedido.status, "pendente");
  requests[1](
    Response.json({ pedido: { status: "preparando", updated_at: "v2" } }),
  );
  await tick();
  assert.equal(snapshot().data.pedido.status, "preparando");
  api.setCustomerResourceIdentity(null);
});
test("healthy public realtime suppresses idle HTTP refreshes and retains recovery and campaign clocks", async () => {
  const timers = new Map(),
    intervals = new Map();
  let next = 0,
    status,
    broadcast,
    hits = 0;
  const target = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  const channel = {
    on(_type, _filter, callback) {
      broadcast = callback;
      return this;
    },
    subscribe(callback) {
      status = callback;
      return this;
    },
  };
  const api = load(
    "src/lib/catalog-updates.ts",
    {
      "@/lib/supabase/client": {
        createClient: () => ({
          channel: () => channel,
          removeChannel: async () => {},
        }),
      },
    },
    {
      document: target,
      window: target,
      setTimeout: (fn) => (timers.set(++next, fn), next),
      clearTimeout: (id) => timers.delete(id),
      setInterval: (fn) => (intervals.set(++next, fn), next),
      clearInterval: (id) => intervals.delete(id),
    },
  );
  const flush = () => {
    for (const [id, fn] of [...timers]) {
      timers.delete(id);
      fn();
    }
  };
  const stop = api.subscribeCatalogUpdates(() => hits++);
  await tick();
  status("SUBSCRIBED");
  flush();
  const initial = hits;
  for (let i = 0; i < 20; i++) {
    for (const fn of intervals.values()) fn();
    flush();
  }
  assert.equal(
    hits,
    initial,
    "ten virtual minutes connected must not reload menu/store",
  );
  broadcast();
  broadcast();
  flush();
  assert.equal(hits, initial + 1);
  status("CHANNEL_ERROR");
  for (const fn of intervals.values()) fn();
  flush();
  assert.equal(hits, initial + 2);
  status("SUBSCRIBED");
  flush();
  assert.equal(hits, initial + 3);
  api.scheduleCatalogRefresh(Date.now() + 1000);
  flush();
  flush();
  assert.equal(
    hits,
    initial + 4,
    "campaign boundary must refresh without idle polling",
  );
  stop();
  assert.equal(timers.size, 0);
});
test("private event connection shares readers, stays idle, refetches on change and falls back on failure", async () => {
  let now = Date.now(),
    calls = 0,
    source,
    subscription;
  const intervals = new Map(),
    timers = new Map();
  let next = 0;
  const target = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  class FakeSource {
    constructor() {
      source = this;
      this.events = {};
    }
    addEventListener(name, fn) {
      this.events[name] = fn;
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
          subscription = subscribe(() => {});
          return get();
        },
      },
    },
    {
      document: target,
      window: target,
      EventSource: FakeSource,
      Date: class extends Date {
        static now() {
          return now;
        }
      },
      fetch: async (url) => {
        if(url === "/api/auth/sessao")return Response.json({cliente:{id:"A"}});
        calls++;
        return Response.json({ pedidos: [] });
      },
      setTimeout: (fn) => (timers.set(++next, fn), next),
      clearTimeout: (id) => timers.delete(id),
      setInterval: (fn) => (intervals.set(++next, fn), next),
      clearInterval: (id) => intervals.delete(id),
    },
  );
  api.setCustomerResourceIdentity("A");
  api.useCustomerResource("A", "/api/pedidos/detalhe?id=one");
  await tick();
  source.events.ready({
    data: JSON.stringify({ owner: "A" }),
    lastEventId: "v1",
  });
  for (let i = 0; i < 20; i++) {
    now += 30_000;
    for (const fn of intervals.values()) fn();
    await tick();
  }
  assert.equal(calls, 1);
  source.events.changed({
    lastEventId: "v2",
    data: JSON.stringify({ id: "one" }),
  });
  source.events.changed({ lastEventId: "v2" });
  for (const [id, fn] of [...timers]) {
    timers.delete(id);
    fn();
  }
  await tick();
  assert.equal(calls, 2);
  source.onerror();
  await tick();
  now += 30_000;
  for (const fn of intervals.values()) fn();
  await tick();
  assert.equal(calls, 3);
  subscription();
  for (const [id, fn] of [...timers]) {
    timers.delete(id);
    fn();
  }
  assert.equal(source.closed, true);
  api.setCustomerResourceIdentity(null);
});
test("freight clock schedules start/end and midnight without waiting for a database write", () => {
  const { nextFreteRefresh } = load("src/lib/promocoes/frete.ts");
  const campaign = {
    data_inicio: "2026-11-02",
    data_fim: "2026-11-02",
    hora_inicio: "13:00",
    hora_fim: "14:00",
  };
  assert.equal(
    nextFreteRefresh([campaign], Date.parse("2026-11-02T12:00:00-03:00")),
    Date.parse("2026-11-02T13:00:00-03:00"),
  );
  assert.equal(
    nextFreteRefresh([campaign], Date.parse("2026-11-02T13:30:00-03:00")),
    Date.parse("2026-11-02T14:01:00-03:00"),
  );
  assert.equal(
    nextFreteRefresh([], Date.parse("2026-11-02T23:59:00-03:00")),
    Date.parse("2026-11-03T00:00:00-03:00"),
  );
});
test("order events reject missing sessions and never trust a client-supplied customer ID", async () => {
  let session = null,
    clients = 0,
    scoped;
  const api = load("src/app/api/pedidos/eventos/route.ts", {
    "@/lib/auth": { obterSessao: async () => session },
    "@/lib/customer-order-hub.server": {
      getOrderEventHub: () => {
        clients++;
        return {};
      },
    },
    "@/lib/customer-order-events.server": {
      customerOrderEvents: (_db, owner) => {
        scoped = owner;
        return Response.json({});
      },
    },
    "@/lib/security/api-response": load("src/lib/security/api-response.ts"),
    "@/lib/security/rate-limit": { RATE_LIMITS: { apiStrict: {}, eventos: {}, eventosUsuario: {} }, rateLimitCheck:async()=>({success:true}), rateLimitHeaders:()=>({}) },
    "@/lib/security/with-api-guard": {
      withApiGuard: (_options, handler) => handler,
    },
  });
  const request = new Request(
    "http://localhost/api/pedidos/eventos?cliente_id=attacker",
  );
  assert.equal((await api.GET(request)).status, 401);
  assert.equal(clients, 0);
  session = { id: "verified-owner" };
  assert.equal((await api.GET(request)).status, 200);
  assert.equal(scoped, "verified-owner");
});
test("automatic printing stops idle checks while connected, coalesces work and cleans up both channels", async () => {
  const effects = [],
    intervals = new Map(),
    handlers = {},
    statuses = {},
    events = new Map();
  let reads = 0,
    removed = 0,
    next = 0;
  const api = load(
    "src/components/admin/pedidos/AutomaticOrderPrint.tsx",
    {
      react: {
        useState: () => [true, () => {}],
        useEffect: (fn) => effects.push(fn),
      },
      "react-dom": { createPortal: () => null },
      "@/lib/supabase/client": {
        createClient: () => ({
          channel: (name) => {
            const key = name.startsWith("auto-print-config")
              ? "config"
              : "orders";
            return {
              on(_type, _filter, fn) {
                handlers[key] = fn;
                return this;
              },
              subscribe(fn) {
                statuses[key] = fn;
                return this;
              },
            };
          },
          removeChannel: async () => removed++,
        }),
      },
      "@/actions/admin/automatic-print": {
        getAutomaticPrintOrders: async () => {
          reads++;
          return {
            enabled: true,
            orders: [],
            serverTime: new Date().toISOString(),
          };
        },
        prepareOrderForAutomaticPrint: async () => null,
      },
      "@/lib/admin/automatic-print": {
        withPrintLock: async (fn) => fn(),
        getSentOrders: () => ({}),
        AUTOMATIC_PRINT_TYPE: "completo",
      },
      "./OrderPrint": { OrderPrint: () => null },
      sonner: { toast: { error() {} } },
    },
    {
      document: { querySelector: () => null },
      window: {
        addEventListener: (name, fn) => events.set(name, fn),
        removeEventListener: (name) => events.delete(name),
      },
      crypto: require("crypto").webcrypto,
      setInterval: (fn) => (intervals.set(++next, fn), next),
      clearInterval: (id) => intervals.delete(id),
    },
  );
  api.AutomaticOrderPrint();
  const cleanup = effects[1]();
  await tick();
  statuses.orders("SUBSCRIBED");
  statuses.config("SUBSCRIBED");
  await tick();
  const initial = reads;
  for (let i = 0; i < 60; i++) for (const fn of intervals.values()) fn();
  await tick();
  assert.equal(reads, initial);
  handlers.orders();
  handlers.orders();
  await tick();
  await tick();
  assert.ok(
    reads <= initial + 2,
    "burst shares running work and queues one recovery",
  );
  cleanup();
  assert.equal(intervals.size, 0);
  assert.equal(removed, 2);
  assert.equal(events.size, 0);
});
test("Strict Mode detach/remount reuses the request and event stream; logout still aborts immediately", async () => {
  const timers = new Map(),
    requests = [],
    subscriptions = [];
  let next = 0,
    streams = 0;
  const target = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  class Source {
    constructor() {
      streams++;
    }
    addEventListener() {}
    close() {}
  }
  const api = load(
    "src/lib/customer-resource.ts",
    {
      react: {
        useCallback: (fn) => fn,
        useSyncExternalStore: (subscribe, get) => {
          subscriptions.push(subscribe(() => {}));
          return get();
        },
      },
    },
    {
      document: target,
      window: target,
      EventSource: Source,
      fetch: (_url, options) =>
        new Promise((resolve) => requests.push({ options, resolve })),
      setInterval: () => 1,
      clearInterval() {},
      setTimeout: (fn) => (timers.set(++next, fn), next),
      clearTimeout: (id) => timers.delete(id),
    },
  );
  api.setCustomerResourceIdentity("A");
  api.useCustomerResource("A", "/api/pedidos/listar?page=0");
  subscriptions[0]();
  api.useCustomerResource("A", "/api/pedidos/listar?page=0");
  for (const [id, fn] of [...timers]) {
    timers.delete(id);
    fn();
  }
  assert.equal(requests.length, 1);
  assert.equal(streams, 1);
  assert.equal(requests[0].options.signal.aborted, false);
  api.setCustomerResourceIdentity(null);
  assert.equal(requests[0].options.signal.aborted, true);
  requests[0].resolve(Response.json({ pedidos: ["old"] }));
  await tick();
});
