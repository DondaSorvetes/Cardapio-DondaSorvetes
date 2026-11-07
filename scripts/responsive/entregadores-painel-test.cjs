const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const out = ts.transpileModule(fs.readFileSync(path.resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", out)((n) => (n in mocks ? mocks[n] : require(n)), mod, mod.exports);
  return mod.exports;
}
const lib = load("src/lib/entregadores.ts");

/** Supabase falso: registra chamadas e responde o que o teste mandar. */
function fakeSupabase(opts = {}) {
  const calls = [];
  const users = opts.users ?? [];
  const perfis = new Set(opts.perfis ?? []);
  const builder = (table) => {
    const q = { table, op: "select", filters: [], payload: null };
    const api = {
      select() { return api; },
      insert(payload) { q.op = "insert"; q.payload = payload; return api; },
      update(payload) { q.op = "update"; q.payload = payload; return api; },
      eq(col, val) { q.filters.push([col, val]); return api; },
      not() { return api; },
      order() { return api; },
      maybeSingle() { return api.then((r) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data })); },
      then(resolve, reject) {
        calls.push({ ...q });
        let result = { data: [], error: null };
        if (table === "perfis") result = { data: q.filters.some(([, v]) => perfis.has(v)) ? [{ id: "x" }] : [], error: null };
        else if (table === "entregadores" && q.op === "insert" && opts.insertError) result = { data: null, error: { message: opts.insertError } };
        else if (table === "entregadores" && q.op === "update") result = { data: [{ id: q.filters[0][1] }], error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return api;
  };
  return {
    calls,
    from: builder,
    rpc: async (name, args) => { calls.push({ rpc: name, args }); return { error: opts.rpcError ? { message: opts.rpcError } : null }; },
    auth: {
      admin: {
        createUser: async (args) => {
          calls.push({ auth: "createUser", args });
          if (opts.createError) return { data: null, error: { message: opts.createError } };
          return { data: { user: { id: "new-user" } }, error: null };
        },
        deleteUser: async (id) => { calls.push({ auth: "deleteUser", id }); return { error: null }; },
        updateUserById: async (id, args) => { calls.push({ auth: "update", id, args }); return { error: null }; },
        listUsers: async () => ({ data: { users }, error: null }),
      },
    },
  };
}

function actions({ allowed = true, supabase = fakeSupabase(), fetchImpl } = {}) {
  const audits = [];
  if (fetchImpl) global.fetch = fetchImpl;
  const mod = load("src/actions/admin/entregadores.ts", {
    "@/lib/admin/auth": {
      requirePermission: async () => {
        if (!allowed) throw new Error("Permissão insuficiente");
        return { admin: { id: "admin-1", email: "admin@x.com" } };
      },
    },
    "@/integrations/supabase/client.server": { createServiceRoleClient: () => supabase },
    "@/lib/security/audit": { writeAudit: async (a) => audits.push(a) },
    "@/lib/security/logger": { securityLog: () => {} },
    "@/lib/entregadores": lib,
    "@/lib/backups": { BACKUP_REPO: "DondaSorvetes/Cardapio-DondaSorvetes" },
  });
  return { ...mod, audits, supabase };
}

test("validação do cadastro", () => {
  assert.deepEqual(lib.validateEntregador({ nome: "João", email: "joao@x.com", senha: "abcdefgh" }, true), {});
  const e = lib.validateEntregador({ nome: " ", email: "joao@", senha: "123" }, true);
  assert.ok(e.nome && e.email && e.senha);
  assert.deepEqual(lib.validateEntregador({ nome: "João", email: "JOAO@X.COM " }, false), {}, "senha opcional ao editar");
  assert.equal(lib.normalizeEmail(" JOAO@X.COM "), "joao@x.com");
});

test("sem admin:manage nenhuma ação de gerenciamento roda", async () => {
  const a = actions({ allowed: false });
  for (const result of await Promise.all([
    a.listEntregadores(),
    a.criarEntregador({ nome: "J", email: "j@x.com", senha: "abcdefgh" }),
    a.vincularContaExistente({ nome: "J", email: "j@x.com" }),
    a.atualizarEntregador("id", { nome: "J", email: "j@x.com" }),
    a.definirAcessoEntregador("id", false),
    a.selecionarEntregador("id"),
    a.getAppEntregadorDownload(),
  ])) assert.equal(result.ok, false);
  assert.equal(a.supabase.calls.length, 0, "nada chega ao banco");
});

test("cadastrar cria a conta confirmada no Auth e o entregador; se falhar, apaga a conta", async () => {
  const ok = actions();
  const r = await ok.criarEntregador({ nome: " João ", email: "JOAO@x.com", senha: "abcdefgh" });
  assert.equal(r.ok, true);
  const create = ok.supabase.calls.find((c) => c.auth === "createUser");
  assert.equal(create.args.email, "joao@x.com");
  assert.equal(create.args.email_confirm, true);
  assert.deepEqual(ok.supabase.calls.find((c) => c.op === "insert").payload, { id: "new-user", nome: "João", email: "joao@x.com" });
  assert.equal(ok.audits[0].action, "entregador.create");
  assert.equal(JSON.stringify(ok.audits).includes("abcdefgh"), false, "senha nunca vai para a auditoria");

  const falha = actions({ supabase: fakeSupabase({ insertError: "boom" }) });
  assert.equal((await falha.criarEntregador({ nome: "J", email: "j@x.com", senha: "abcdefgh" })).ok, false);
  assert.ok(falha.supabase.calls.some((c) => c.auth === "deleteUser" && c.id === "new-user"));

  const existe = actions({ supabase: fakeSupabase({ createError: "A user with this email address has already been registered" }) });
  const r2 = await existe.criarEntregador({ nome: "J", email: "j@x.com", senha: "abcdefgh" });
  assert.equal(r2.code, "EMAIL_EXISTE");
});

test("vincular conta existente: só se não for da equipe", async () => {
  const users = [{ id: "u-staff", email: "staff@x.com" }, { id: "u-livre", email: "livre@x.com" }];
  const staff = actions({ supabase: fakeSupabase({ users, perfis: ["u-staff"] }) });
  const r = await staff.vincularContaExistente({ nome: "S", email: "STAFF@x.com" });
  assert.equal(r.ok, false);
  assert.ok(!staff.supabase.calls.some((c) => c.op === "insert"));
  const livre = actions({ supabase: fakeSupabase({ users }) });
  assert.equal((await livre.vincularContaExistente({ nome: "L", email: "livre@x.com" })).ok, true);
  assert.equal((await livre.vincularContaExistente({ nome: "L", email: "nao@x.com" })).ok, false);
});

test("desativar bloqueia o login no Auth; reativar libera", async () => {
  const a = actions();
  await a.definirAcessoEntregador("u1", false);
  await a.definirAcessoEntregador("u1", true);
  const bans = a.supabase.calls.filter((c) => c.auth === "update").map((c) => c.args.ban_duration);
  assert.deepEqual(bans, ["876000h", "none"]);
  assert.deepEqual(a.audits.map((x) => x.action), ["entregador.disable", "entregador.enable"]);
});

test("selecionar usa a função do banco e traduz entregador inválido", async () => {
  const a = actions();
  assert.equal((await a.selecionarEntregador("u1")).ok, true);
  assert.deepEqual(a.supabase.calls[0], { rpc: "admin_selecionar_entregador", args: { p_entregador_id: "u1" } });
  const inv = actions({ supabase: fakeSupabase({ rpcError: "ENTREGADOR_INVALIDO" }) });
  const r = await inv.selecionarEntregador("u2");
  assert.equal(r.ok, false);
  assert.match(r.error, /ativo/);
});

test("download do app: pega o .apk do release do entregador, nunca o do app Windows", async () => {
  const releases = [
    { tag_name: "v1.2.3", draft: false, published_at: "2026-11-04", assets: [{ name: "Donda-Setup-1.2.3.exe", browser_download_url: "u-exe", size: 1 }] },
    { tag_name: "entregador-v1.1.0", draft: true, published_at: null, assets: [{ name: "entregador.apk", browser_download_url: "u-draft", size: 1 }] },
    { tag_name: "entregador-v1.0.0", draft: false, published_at: "2026-11-05", assets: [{ name: "Donda-Entregador-1.0.0.apk", browser_download_url: "u-apk", size: 2048 }] },
  ];
  const a = actions({ fetchImpl: async () => ({ ok: true, json: async () => releases }) });
  const r = await a.getAppEntregadorDownload();
  assert.deepEqual(r.app, { disponivel: true, versao: "1.0.0", url: "u-apk", tamanho: 2048, publicadoEm: "2026-11-05" });
  const vazio = actions({ fetchImpl: async () => ({ ok: true, json: async () => [releases[0]] }) });
  assert.equal((await vazio.getAppEntregadorDownload()).app.disponivel, false);
});

test("painel: seção nas Configurações, aviso no Kanban e nenhuma chave no navegador", () => {
  const manager = fs.readFileSync("src/components/admin/sistema/SistemaConfigManager.tsx", "utf8");
  assert.match(manager, /\{ id: "entregadores", label: "Entregadores" \}/);
  const section = fs.readFileSync("src/components/admin/sistema/EntregadoresSection.tsx", "utf8");
  assert.doesNotMatch(section, /service_role|createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY/);
  const pedidos = fs.readFileSync("src/components/admin/pedidos/PedidosManager.tsx", "utf8");
  assert.match(pedidos, /!entregadores\.selecionado/);
  const actionsSrc = fs.readFileSync("src/actions/admin/entregadores.ts", "utf8");
  assert.match(actionsSrc, /^"use server";/);
});

test("cliente vê só o primeiro nome do entregador, nunca o id", () => {
  assert.equal(lib.primeiroNome("  João   da Silva "), "João");
  assert.equal(lib.primeiroNome(""), null);
  assert.equal(lib.primeiroNome(null), null);
  const rota = fs.readFileSync("src/app/api/pedidos/detalhe/route.ts", "utf8");
  assert.match(rota, /const \{ entregador_id, \.\.\.publico \} = pedido;/);
  assert.match(rota, /\.\.\.publico,\s*entregador_nome,/);
  assert.match(rota, /pedido\.status === "saiu_entrega" \|\| pedido\.status === "entregue"/);
  const tela = fs.readFileSync("src/components/cliente/pedidos/DetalhePedidoView.tsx", "utf8");
  assert.match(tela, /está levando seu pedido até você/);
  assert.match(tela, /Entregue por/);
});
