const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), ts = require('typescript'), { createRequire } = require('node:module');
function load(file, mocks = {}) {
  const absolute = path.resolve(file), native = createRequire(absolute), mod = { exports: {} };
  const requireLocal = name => mocks[name] ?? (name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts', mocks) : native(name));
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText)(requireLocal, mod, mod.exports);
  return mod.exports;
}
let enabled = true, status = 'pendente', writes = 0, allowed = true, required = [];
const now = new Date().toISOString();
const order = () => ({ id: 'order-test', status, created_at: now, itens: [], subtotal: 20, taxa_entrega: 3, total: 23, endereco_completo: null });
const db = { from(table) {
  let updating = false, allowedStatuses;
  const q = {
    select() { return this; }, order() { return this; }, limit() { return this; }, gte() { return this; }, eq() { return this; },
    in(_, statuses) { allowedStatuses = statuses; return this; },
    update() { updating = true; return this; },
    maybeSingle: async () => ({ data: table === 'configuracoes_loja' ? { imprimir_aceitar_automaticamente: enabled } : order() }),
    then(resolve) {
      if (updating && allowedStatuses.includes(status)) { writes++; status = 'preparando'; }
      return Promise.resolve({ data: updating ? null : [order()] }).then(resolve);
    },
  }; return q;
} };
const mocks = {
  '@/lib/admin/auth': { requirePermission: async permission => { required.push(permission); if (!allowed) throw Error('Forbidden'); } },
  '@/integrations/supabase/client.server': { createServiceRoleClient: () => db },
};
(async () => {
  const actions = load('src/actions/admin/automatic-print.ts', mocks);
  assert.deepEqual((await actions.getAutomaticPrintOrders(null)).orders, [], 'Never print historical backlog at startup');
  assert.equal((await actions.getAutomaticPrintOrders(now)).orders.length, 1);
  assert.equal((await actions.prepareOrderForAutomaticPrint('order-test')).status, 'preparando');
  assert.equal(writes, 1);
  await actions.prepareOrderForAutomaticPrint('order-test'); assert.equal(writes, 1, 'Already preparing does not repeat transition');
  for (const advanced of ['cancelado', 'entregue', 'saiu_entrega']) { status = advanced; assert.equal(await actions.prepareOrderForAutomaticPrint('order-test'), null); assert.equal(status, advanced); }
  enabled = false; status = 'pendente';
  assert.deepEqual((await actions.getAutomaticPrintOrders(now)).orders, []);
  assert.equal(await actions.prepareOrderForAutomaticPrint('order-test'), null); assert.equal(writes, 1);
  allowed = false; await assert.rejects(() => actions.getAutomaticPrintOrders(now), /Forbidden/);
  assert.ok(required.every(permission => permission === 'pedido:update_status'));
  const storage = new Map(); global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const client = load('src/lib/admin/automatic-print.ts');
  assert.equal(client.AUTOMATIC_PRINT_TYPE, 'completo');
  client.markOrderSent('order-test'); assert.ok(client.getSentOrders()['order-test']);
  storage.set('donda-auto-print-sent', 'null'); assert.deepEqual(client.getSentOrders(), {});
  storage.set('donda-auto-print-sent', 'not-json'); assert.deepEqual(client.getSentOrders(), {});
  allowed = true;
  let settings = { id: 1, imprimir_aceitar_automaticamente: false, aceitar_pedidos_automaticamente: false }, failSave = false;
  const settingsDb = { from() {
    let patch;
    return { select() { return this; }, order() { return this; }, limit() { return this; }, eq() { return this; }, update(value) { patch = value; return this; },
      maybeSingle: async () => {
        if (patch && failSave) return { data: null, error: { message: 'missing column' } };
        if (patch) settings = { ...settings, ...patch };
        return { data: settings, error: null };
      },
    };
  } };
  const settingsActions = load('src/actions/admin/estabelecimento-settings.ts', { ...mocks, '@/integrations/supabase/client.server': { createServiceRoleClient: () => settingsDb } });
  let result = await settingsActions.updatePreferenciasEstabelecimento({ aceitar_pedidos_automaticamente: true });
  assert.equal(result.imprimir_aceitar_automaticamente, false, 'Accept-only must not enable printing');
  result = await settingsActions.updatePreferenciasEstabelecimento({ imprimir_aceitar_automaticamente: true });
  assert.equal(result.imprimir_aceitar_automaticamente, true); assert.equal(result.aceitar_pedidos_automaticamente, true);
  result = await settingsActions.updatePreferenciasEstabelecimento({ imprimir_aceitar_automaticamente: false });
  assert.equal(result.aceitar_pedidos_automaticamente, true, 'Disabling printing preserves separately enabled auto-accept');
  failSave = true;
  await assert.rejects(() => settingsActions.updatePreferenciasEstabelecimento({ imprimir_aceitar_automaticamente: true }), /Não foi possível salvar/);
  console.log('Automatic print contracts passed: permissions, startup baseline, disabled mode, conditional prepare, completed/cancelled protection and dispatch deduplication. No live order changes or printing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
