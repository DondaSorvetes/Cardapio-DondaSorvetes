const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file) {
  const mod = { exports: {} };
  const out = ts.transpileModule(fs.readFileSync(path.resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", out)(require, mod, mod.exports);
  return mod.exports;
}
const { createAutosave } = load("src/components/admin/estabelecimento/autosave.ts");
const { validateConfig, hhmm } = load("src/components/admin/estabelecimento/validation.ts");

/** Relógio manual e servidor com respostas controladas pelo teste. */
function harness() {
  const timers = [];
  const calls = [];
  const statuses = [];
  const saved = [];
  const queue = createAutosave({
    delay: 800,
    schedule: (fn) => { const t = { fn, live: true }; timers.push(t); return t; },
    cancel: (t) => { t.live = false; },
    save: (patch) => new Promise((resolve, reject) => calls.push({ patch, resolve, reject })),
    onSaved: (patch, result) => saved.push({ patch, result, pendingDuring: [...queue.pendingKeys()] }),
    onStatus: (s) => statuses.push(s),
  });
  const tick = () => timers.filter((t) => t.live).forEach((t) => { t.live = false; t.fn(); });
  const flushMicro = () => new Promise((r) => setImmediate(r));
  return { queue, calls, statuses, saved, tick, flushMicro };
}

test("typing is debounced into one save with the latest values", async () => {
  const h = harness();
  h.queue.queue({ nome: "S" });
  h.queue.queue({ nome: "So" });
  h.queue.queue({ nome: "Sof" });
  assert.equal(h.calls.length, 0);
  h.tick();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].patch, { nome: "Sof" });
});

test("edits made while a save is in flight go in the next save, never in parallel", async () => {
  const h = harness();
  h.queue.queue({ nome: "Soft" }, true);
  assert.equal(h.calls.length, 1);
  h.queue.queue({ nome: "SoftS" });
  h.queue.queue({ esta_aberto: true }, true);
  h.tick();
  assert.equal(h.calls.length, 1, "no second request while the first is pending");
  h.calls[0].resolve({ nome: "Soft" });
  await h.flushMicro();
  // A resposta antiga chegou com "nome" ainda pendente: quem usa a fila não a aplica.
  assert.deepEqual(h.saved[0].pendingDuring.sort(), ["esta_aberto", "nome"]);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls[1].patch, { nome: "SoftS", esta_aberto: true });
  h.calls[1].resolve({});
  await h.flushMicro();
  assert.equal(h.statuses.at(-1), "saved");
  assert.equal(h.queue.isDirty(), false);
});

test("a failed save keeps the changes, newer edits win, and retry resends", async () => {
  const h = harness();
  h.queue.queue({ cidade: "Poloni", telefone: "1" }, true);
  h.calls[0].reject(new Error("offline"));
  await h.flushMicro();
  assert.equal(h.statuses.at(-1), "error");
  assert.equal(h.queue.isDirty(), true);
  h.queue.queue({ telefone: "12" });
  h.tick();
  assert.deepEqual(h.calls[1].patch, { cidade: "Poloni", telefone: "12" });
  h.calls[1].reject(new Error("offline"));
  await h.flushMicro();
  h.queue.retry();
  assert.deepEqual(h.calls[2].patch, { cidade: "Poloni", telefone: "12" });
});

test("flush saves right away (blur, section change, leaving the page) and resolves when done", async () => {
  const h = harness();
  let done = false;
  h.queue.queue({ endereco: "Rua A" });
  void h.queue.flush().then(() => { done = true; });
  assert.equal(h.calls.length, 1);
  await h.flushMicro();
  assert.equal(done, false);
  h.calls[0].resolve({});
  await h.flushMicro();
  assert.equal(done, true);
  await h.queue.flush();
  assert.equal(h.calls.length, 1, "nothing pending, nothing sent");
});

test("validation keeps invalid values on screen instead of sending them", () => {
  const base = { nome: "Sorvetes Donda", taxa_entrega: 5, pedido_minimo: null, tempo_entrega_min: 30, tempo_entrega_max: 45 };
  assert.deepEqual(validateConfig(base), {});
  assert.ok(validateConfig({ ...base, nome: "   " }).nome);
  assert.ok(validateConfig({ ...base, taxa_entrega: -1 }).taxa_entrega);
  assert.ok(validateConfig({ ...base, pedido_minimo: Number.NaN }).pedido_minimo);
  assert.ok(validateConfig({ ...base, tempo_entrega_max: 20 }).tempo_entrega_max);
  assert.equal(hhmm("18:00:00"), "18:00");
  assert.equal(hhmm(null), "");
});

test("the establishment form never locks fields while saving", () => {
  const src = fs.readFileSync("src/components/admin/estabelecimento/EstabelecimentoManager.tsx", "utf8");
  assert.doesNotMatch(src, /disabled=\{saving\}/);
  assert.doesNotMatch(src, /toast\.success\("Alterações salvas/);
  assert.match(src, /createAutosave/);
  assert.match(src, /onBlur: \(\) => void autosave\.flush\(\)/);
  assert.match(src, /busy\.has\(key\)/, "server response must not overwrite fields still being edited");
});
