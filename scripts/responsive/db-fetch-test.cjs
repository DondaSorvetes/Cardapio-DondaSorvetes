/**
 * Limite de requisições ao banco por instância (src/integrations/supabase/db-fetch.ts):
 * concorrência máxima, fila limitada, timeout na fila e na requisição, vaga
 * liberada em erro, e Storage/Auth fora do limite.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync("src/integrations/supabase/db-fetch.ts", "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function("module", "exports", "require", outputText)(mod, mod.exports, require);
  return mod.exports;
}
const { createDbFetch, readDbFetchOptions, DB_FETCH_DEFAULTS, isDatabaseRequest } = load();
const REST = "https://x.supabase.co/rest/v1/pedidos?select=id";

/** fetch falso: cada chamada fica pendente até liberar(); respeita o abort. */
function fakeFetch() {
  const pending = [];
  let calls = 0;
  const fetch = (input, init) => {
    calls++;
    return new Promise((resolve, reject) => {
      const item = { input, resolve: () => resolve(new Response("[]", { status: 200 })) };
      pending.push(item);
      init?.signal?.addEventListener("abort", () => reject(init.signal.reason));
    });
  };
  return { fetch, pending, calls: () => calls };
}
const tick = () => new Promise((r) => setImmediate(r));

test("no máximo maxConcurrent requisições ao banco em andamento; o resto espera a vez", async () => {
  const base = fakeFetch();
  const db = createDbFetch(base.fetch, { ...DB_FETCH_DEFAULTS, maxConcurrent: 2 });
  const results = [db(REST), db(REST), db(REST)];
  await tick();
  assert.equal(base.calls(), 2);
  assert.deepEqual(db.stats(), { active: 2, queued: 1 });
  base.pending.shift().resolve();
  await tick();
  await tick();
  assert.equal(base.calls(), 3, "a terceira entra quando uma termina");
  base.pending.splice(0).forEach((p) => p.resolve());
  for (const response of await Promise.all(results)) assert.equal(response.status, 200);
  assert.deepEqual(db.stats(), { active: 0, queued: 0 });
});

test("fila cheia falha na hora e fila lenta falha por tempo, sem chamar o banco", async () => {
  const base = fakeFetch();
  const db = createDbFetch(base.fetch, { maxConcurrent: 1, maxQueue: 1, queueTimeoutMs: 30, requestTimeoutMs: 5_000 });
  const first = db(REST);
  const waiting = db(REST);
  await assert.rejects(db(REST), { name: "DbBusyError", message: /fila/ });
  await assert.rejects(waiting, { name: "DbBusyError", message: /tempo de espera/ });
  assert.equal(base.calls(), 1);
  base.pending.shift().resolve();
  await first;
  assert.deepEqual(db.stats(), { active: 0, queued: 0 });
});

test("requisição travada é abortada no timeout e libera a vaga", async (t) => {
  // AbortSignal.timeout não segura o processo vivo (no Node 22 o teste terminaria
  // antes do timeout); num servidor de verdade o processo já está ativo.
  const vivo = setInterval(() => {}, 1_000);
  t.after(() => clearInterval(vivo));
  const base = fakeFetch();
  const db = createDbFetch(base.fetch, { maxConcurrent: 1, maxQueue: 10, queueTimeoutMs: 5_000, requestTimeoutMs: 30 });
  await assert.rejects(db(REST), { name: "TimeoutError" });
  assert.deepEqual(db.stats(), { active: 0, queued: 0 });
  const next = db(REST);
  await tick();
  base.pending.at(-1).resolve();
  assert.equal((await next).status, 200);
});

test("erro de rede libera a vaga; o abort de quem chamou continua valendo", async () => {
  let fail = true;
  const db = createDbFetch(async (_, init) => {
    if (fail) throw new TypeError("fetch failed");
    // Como o fetch real: sinal já abortado rejeita na hora.
    if (init.signal.aborted) throw init.signal.reason;
    return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
  }, { ...DB_FETCH_DEFAULTS, maxConcurrent: 1 });
  await assert.rejects(db(REST), /fetch failed/);
  assert.equal(db.stats().active, 0);
  fail = false;
  const controller = new AbortController();
  const request = db(REST, { signal: controller.signal });
  controller.abort(new Error("cancelado"));
  await assert.rejects(request, /cancelado/);
  assert.equal(db.stats().active, 0);
});

test("Storage, Auth e Realtime não passam pelo limite; 204 continua sem corpo", async () => {
  assert.equal(isDatabaseRequest(REST), true);
  assert.equal(isDatabaseRequest("https://x.supabase.co/rest/v1/rpc/entregador_perfil"), true);
  assert.equal(isDatabaseRequest("https://x.supabase.co/storage/v1/object/a.png"), false);
  assert.equal(isDatabaseRequest("https://x.supabase.co/auth/v1/user"), false);
  const base = fakeFetch();
  const db = createDbFetch(base.fetch, { ...DB_FETCH_DEFAULTS, maxConcurrent: 1 });
  db(REST);
  const storage = db("https://x.supabase.co/storage/v1/object/a.png");
  await tick();
  assert.equal(base.calls(), 2, "storage não espera a vaga do banco");
  base.pending.forEach((p) => p.resolve());
  await storage;
  const empty = await createDbFetch(async () => new Response(null, { status: 204 }))(REST, { method: "PATCH" });
  assert.equal(empty.status, 204);
  assert.equal(await empty.text(), "");
});

test("limites vêm das variáveis de ambiente; valores inválidos usam o padrão", () => {
  assert.deepEqual(readDbFetchOptions({}), DB_FETCH_DEFAULTS);
  assert.deepEqual(
    readDbFetchOptions({ SUPABASE_DB_MAX_CONCURRENT: "4", SUPABASE_DB_MAX_QUEUE: "abc", SUPABASE_DB_QUEUE_TIMEOUT_MS: "-1", SUPABASE_DB_REQUEST_TIMEOUT_MS: "8000" }),
    { ...DB_FETCH_DEFAULTS, maxConcurrent: 4, requestTimeoutMs: 8000 },
  );
});
