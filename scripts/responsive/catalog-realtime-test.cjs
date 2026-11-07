const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', ...Object.keys(globals), source)(name => { if (name in mocks) return mocks[name]; throw Error(name); }, exports, ...Object.values(globals));
  return exports;
}
test('only successful public catalog writes schedule invalidation; payload contains no rows', async () => {
  const callbacks = [], invalidated = [], requests = [];
  let ok = true;
  const api = load('src/lib/catalog-fetch.server.ts', {
    '@/lib/public-read.server': { invalidatePublicReads() {} },
    'server-only': {}, 'next/server': { after: callback => callbacks.push(callback) },
    'next/cache': { revalidateTag() {}, revalidatePath: path => invalidated.push(path) },
  }, { fetch: async (url, init) => { requests.push({ url, init }); return new Response('{}', { status: ok ? 200 : 400 }); },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-secret' } } });
  await api.catalogFetch('https://example.supabase.co/rest/v1/produtos');
  await api.catalogFetch('https://example.supabase.co/rest/v1/pedidos', { method: 'POST' });
  ok = false;
  await api.catalogFetch('https://example.supabase.co/rest/v1/produtos', { method: 'PATCH' });
  assert.equal(callbacks.length, 0);
  ok = true;
  for (const table of ['produtos', 'categorias', 'combos', 'combo_itens', 'configuracoes_loja', 'promocoes_frete_gratis', 'produto_grupos', 'opcoes', 'grupos_opcoes', 'tags']) {
    await api.catalogFetch(`https://example.supabase.co/rest/v1/${table}`, { method: 'PATCH' });
  }
  assert.equal(callbacks.length, 10);
  await callbacks[0]();
  assert.deepEqual(invalidated, ['/']);
  const payload = JSON.parse(requests.at(-1).init.body);
  assert.deepEqual(payload.messages, [{ topic: 'public-catalog', event: 'changed', payload: {}, private: false }]);
});
test('one client channel, burst coalescing, reconnect refresh, hidden-tab pause and cleanup', async () => {
  const timers = new Map(), intervals = new Map(), events = new Map();
  let next = 0, channels = 0, removed = 0, broadcast, status, hits = 0;
  const target = { visibilityState: 'visible', addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) };
  const supabase = { channel() { channels++; return { on(_type, _filter, callback) { broadcast = callback; return this; }, subscribe(callback) { status = callback; return this; } }; }, async removeChannel() { removed++; } };
  const api = load('src/lib/catalog-updates.ts', { '@/lib/supabase/client': { createClient: () => supabase } }, {
    document: target, window: target, setTimeout: callback => { timers.set(++next, callback); return next; }, clearTimeout: id => timers.delete(id),
    setInterval: callback => { intervals.set(++next, callback); return next; }, clearInterval: id => intervals.delete(id),
  });
  const flush = () => { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } };
  const one = api.subscribeCatalogUpdates(() => hits++);
  const two = api.subscribeCatalogUpdates(() => hits++);
  await Promise.resolve();
  assert.equal(channels, 1);
  flush(); assert.equal(hits, 2);
  broadcast(); broadcast(); broadcast(); flush(); assert.equal(hits, 4);
  target.visibilityState = 'hidden'; broadcast(); flush(); assert.equal(hits, 4);
  target.visibilityState = 'visible'; status('SUBSCRIBED'); flush(); assert.equal(hits, 6);
  one(); assert.equal(removed, 0); two(); assert.equal(removed, 1);
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(events.size, 0);
  const three = api.subscribeCatalogUpdates(() => {}); three();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(channels, 1, 'an abandoned Strict Mode subscription must not create a channel');
});
