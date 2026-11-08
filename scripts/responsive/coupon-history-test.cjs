const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
function load(file, mocks = {}) {
  const absolute = path.resolve(file), native = createRequire(absolute), mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => mocks[name] ?? (name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts', mocks) : native(name)), mod, mod.exports);
  return mod.exports;
}
let coupon = { codigo: 'TESTE', nome: 'Cupom', tipo: 'percentual', valor: 10, valor_minimo: 20, usos: 0, limite_usos: 5, ativo: true, data_inicio: '2026-01-01', data_fim: '2026-12-31' };
const { validarCupom } = load('src/lib/cupons.ts', {
  '@/integrations/supabase/client.server': { createServiceRoleClient: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: coupon }) }) }) },
  '@/lib/promocoes/frete': { getSaoPauloDateTime: () => ({ date: '2026-10-30' }) },
});
(async () => {
  assert.equal((await validarCupom('teste', 50)).desconto, 5);
  await assert.rejects(() => validarCupom('TESTE', 10), /mínimo/);
  coupon = { ...coupon, tipo: 'valor_fixo', valor: 100 };
  assert.equal((await validarCupom('TESTE', 50)).desconto, 50);
  for (const patch of [{ ativo: false }, { usos: 5 }, { data_fim: '2026-01-01' }]) {
    const previous = coupon; coupon = { ...coupon, ...patch };
    await assert.rejects(() => validarCupom('TESTE', 50)); coupon = previous;
  }
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { OrderPrint } = load('src/components/admin/pedidos/OrderPrint.tsx');
  const pedido = { id: '12345678', cliente_nome: 'Teste', tipo_entrega: 'entrega', status: 'pendente', created_at: '2026-10-30T12:00:00Z', meio_pagamento: 'pix', subtotal: 50, taxa_entrega: 3, total: 48, cupom_codigo: 'CODIGO_HISTORICO', desconto_cupom: 5, itens: [{ qty: 1, total: 50, produto: { id: '1', name: 'Açaí', price: 50 } }] };
  const html = renderToStaticMarkup(React.createElement(OrderPrint, { pedido, tipo: 'entrega' }));
  assert.ok(html.includes('CODIGO_HISTORICO'));
  assert.ok(html.includes('5,00'));
  assert.ok(html.includes('48,00'));
  const plain = renderToStaticMarkup(React.createElement(OrderPrint, { pedido: { ...pedido, cupom_codigo: null, desconto_cupom: 0 }, tipo: 'entrega' }));
  assert.ok(!plain.includes('CODIGO_HISTORICO'));
  const kitchen = renderToStaticMarkup(React.createElement(OrderPrint, { pedido, tipo: 'cozinha' }));
  assert.ok(!kitchen.includes('CODIGO_HISTORICO'), 'Kitchen has no financial section');
  const { AUTOMATIC_PRINT_TYPE } = load('src/lib/admin/automatic-print.ts');
  const both = renderToStaticMarkup(React.createElement(OrderPrint, { pedido, tipo: AUTOMATIC_PRINT_TYPE }));
  assert.equal((both.match(/class="print-ticket"/g) || []).length, 2, 'Automatic job must include kitchen and customer tickets');
  assert.ok(both.indexOf('CUPOM COZINHA') < both.indexOf('CUPOM ENTREGA / CLIENTE'));
  assert.ok(both.includes('CODIGO_HISTORICO') && both.includes('48,00'), 'Customer ticket must retain confirmed discount and total');
  // Historical rendering uses the saved order, without consulting the now inactive coupon.
  coupon = { ...coupon, ativo: false, valor: 99 };
  assert.equal(renderToStaticMarkup(React.createElement(OrderPrint, { pedido, tipo: 'entrega' })), html);
  let inserted = null;
  const db = { from(table) {
    const query = {
      select() { return this; }, order() { return this; }, limit() { return this; }, eq() { return this; }, lte() { return this; }, gte() { return this; },
      maybeSingle: async () => ({ data: { esta_aberto: true, aceitando_pedidos: true, taxa_entrega: 3, aceitar_pedidos_automaticamente: false, imprimir_aceitar_automaticamente: true } }),
      in() { return this; },
      then(resolve) { return Promise.resolve({ data: table === "produtos" ? [{ id: 1, nome: "Produto fictício", descricao: "", preco_base: 50, preco_promocional: null, esta_disponivel: true, imagem_url: null }] : [] }).then(resolve); },
      insert(value) { inserted = value; return this; },
      // Emulates the existing database trigger's confirmed result, not a live DB test.
      single: async () => ({ data: { id: 'mock-order', ...inserted, total: 48, desconto_cupom: 5 } }),
    };
    assert.ok(['configuracoes_loja', 'promocoes_frete_gratis', 'opcoes', 'grupos_opcoes', 'pedidos', 'produtos'].includes(table));
    return query;
  } };
  const { POST } = load('src/app/api/pedidos/criar/route.ts', {
    'next/server': { after() {} },
    '@/lib/push/pedido-push.server': { notifyNewOrder: async () => {} },
    '@/lib/auth': { obterSessao: async () => ({ id: 'test' }) },
    '@/integrations/supabase/client.server': { createServerClient: () => db },
    '@/lib/utils/pedido': { enrichPedidoItens: itens => itens },
    '@/lib/security/with-api-guard': { withApiGuard: (_, handler) => handler },
    '@/lib/security/rate-limit': { RATE_LIMITS: { checkout: {} }, rateLimitCheck: async()=>({success:true}), rateLimitHeaders: ()=>({}) },
    '@/lib/security/api-response': { apiOk: (data, status) => ({ data, status }), apiError: (message, status) => ({ message, status }), apiServerError: error => { throw error; }, apiUnauthorized: () => ({ status: 401 }), apiValidation: message => ({ message, status: 400 }) },
    '@/lib/security/sanitize': { sanitizeText: value => value, sanitizePhone: value => value },
    '@/lib/security/logger': { securityLog() {} },
    '@/lib/promocoes/frete': { getSaoPauloDateTime: () => ({ date: '2026-10-30' }), isFreteCampaignActive: () => false },
    '@/lib/cupons': { validarCupom },
    '@/lib/combos/options': { loadComboOptionGroups: async()=>[], resolveComboChoices: ()=>({ resolved: [], extras: 0 }) },
  });
  const body = { cliente_nome: 'Teste', cliente_telefone: '17900000000', tipo_entrega: 'entrega', endereco_completo: 'Rua Teste, 10', meio_pagamento: 'pix', subtotal: 50, taxa_entrega: 3, total: 1, cupom_codigo: 'TESTE', itens: [{ produto: { id: '1' }, qty: 1, total: 50 }] };
  // Coupon was deactivated after the bag validation: checkout must reject before insert.
  assert.equal((await POST({ json: async () => body }, { ip: 'test' })).status, 400);
  assert.equal(inserted, null);
  coupon = { ...coupon, ativo: true, tipo: 'percentual', valor: 10 };
  const response = await POST({ json: async () => body }, { ip: 'test' });
  assert.equal(response.status, 201);
  assert.equal(inserted.status, "preparando", "Print automation must prepare new orders even when legacy auto-accept is false");
  assert.equal(inserted.total, 53, 'Do not subtract client discount before database trigger');
  assert.equal(inserted.desconto_cupom, undefined);
  assert.equal(response.data.pedido.total, 48, 'Return confirmed result, not forged client total');
  console.log('Coupon validation, checkout revalidation, confirmed totals and historical delivery/kitchen printing passed. No live writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
