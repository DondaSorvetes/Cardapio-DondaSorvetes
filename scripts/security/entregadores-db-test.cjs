/**
 * Testa a migration 0019 (entregadores) num Postgres em memória (PGlite), com os
 * cenários do app de entregadores: atribuição só ao sair para entrega, isolamento
 * entre entregadores, conclusão idempotente, desativação e permissões.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const { aplicarRenomeacaoDonda } = require("./migrations-helper.cjs");

const JOAO = "00000000-0000-4000-8000-00000000000a";
const PEDRO = "00000000-0000-4000-8000-00000000000b";
const CARLOS = "00000000-0000-4000-8000-00000000000c";
const STAFF = "00000000-0000-4000-8000-0000000000ad";
const ESTRANHO = "00000000-0000-4000-8000-0000000000ee";

const BASE = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
-- Stub do Supabase Realtime: guarda os avisos enviados.
CREATE SCHEMA realtime;
CREATE TABLE realtime.messages (id serial PRIMARY KEY, topic text, extension text, event text, payload jsonb, private boolean);
CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('realtime.topic', true) $$;
CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
  LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO realtime.messages (topic, extension, event, payload, private) VALUES (topic, 'broadcast', event, payload, private) $$;
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA realtime TO authenticated, service_role;
GRANT SELECT ON realtime.messages TO authenticated;
GRANT ALL ON realtime.messages TO service_role;
-- Estrutura atual (produção) do que a migration usa.
CREATE TABLE public.perfis (id uuid PRIMARY KEY REFERENCES auth.users (id), role text);
CREATE TABLE public.audit_logs (id bigserial PRIMARY KEY, actor_id text, actor_email text, action text NOT NULL, entity text, entity_id text, ip text, before jsonb, after jsonb, result text DEFAULT 'ok', meta jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text NOT NULL, cliente_telefone text NOT NULL,
  tipo_entrega text NOT NULL CHECK (tipo_entrega IN ('entrega','retirada')),
  endereco_completo jsonb, meio_pagamento text NOT NULL, troco_para text,
  subtotal numeric(10,2) NOT NULL, taxa_entrega numeric(10,2) DEFAULT 0, total numeric(10,2) NOT NULL,
  itens jsonb NOT NULL, status text DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','preparando','saiu_entrega','entregue','cancelado')),
  observacoes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
INSERT INTO auth.users VALUES ('${JOAO}','joao@x.com'),('${PEDRO}','pedro@x.com'),('${CARLOS}','carlos@x.com'),('${STAFF}','staff@x.com'),('${ESTRANHO}','x@x.com');
INSERT INTO public.perfis VALUES ('${STAFF}','admin');
`;

async function setup() {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(fs.readFileSync("supabase/migrations/0019_entregadores.sql", "utf8"));
  await aplicarRenomeacaoDonda(db);
  // Servidor do painel (service_role) cadastra os entregadores.
  await db.exec(`INSERT INTO public.entregadores (id, nome, email) VALUES
    ('${JOAO}','João','JOAO@x.com '),('${PEDRO}','Pedro','pedro@x.com'),('${CARLOS}','Carlos','carlos@x.com');
    UPDATE public.entregadores SET ativo = false WHERE id = '${CARLOS}';`);
  return db;
}

async function as(db, uid, role = "authenticated") {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec(`SET ROLE ${role}`);
}
const asServer = async (db) => { await db.exec("RESET ROLE"); await db.exec("SET ROLE service_role"); };
const asOwner = (db) => db.exec("RESET ROLE");

async function novoPedido(db, extra = {}) {
  await asOwner(db);
  const { rows } = await db.query(
    `INSERT INTO public.pedidos (cliente_nome, cliente_telefone, tipo_entrega, endereco_completo, meio_pagamento, troco_para, subtotal, total, itens, status)
     VALUES ($1, '11999990000', $2, '{"logradouro":"Rua A","numero":"10"}', $3, $4, 40, 45, $5, 'preparando') RETURNING id`,
    [extra.nome ?? "Cliente", extra.tipo ?? "entrega", extra.pagamento ?? "dinheiro", extra.troco ?? "50",
     JSON.stringify([{ qty: 2, produto: { name: "Açaí 500ml" }, observacoes: "sem granola" }])],
  );
  return rows[0].id;
}

/** Kanban do painel: o servidor muda o status (service_role). */
async function mudarStatus(db, id, status) {
  await asServer(db);
  await db.query("UPDATE public.pedidos SET status = $2 WHERE id = $1", [id, status]);
}
async function pedido(db, id) {
  await asOwner(db);
  return (await db.query("SELECT status, entregador_id, saiu_entrega_at, entregue_at FROM public.pedidos WHERE id = $1", [id])).rows[0];
}
async function selecionar(db, id) {
  await asServer(db);
  await db.query("SELECT public.admin_selecionar_entregador($1)", [id]);
}
async function minhas(db, uid) {
  await as(db, uid);
  return (await db.query("SELECT * FROM public.entregador_minhas_entregas()")).rows;
}
async function concluir(db, uid, id) {
  await as(db, uid);
  return (await db.query("SELECT public.entregador_concluir_entrega($1) AS r", [id])).rows[0].r;
}
const erro = async (promise, code) => {
  await assert.rejects(promise, (e) => { assert.match(String(e.message), new RegExp(code)); return true; });
};

test("1–2: só entregador cadastrado e ativo passa; equipe e outros usuários não", async () => {
  const db = await setup();
  try {
    await as(db, JOAO);
    assert.deepEqual((await db.query("SELECT nome FROM public.entregador_perfil()")).rows, [{ nome: "João" }]);
    for (const uid of [STAFF, ESTRANHO]) {
      await as(db, uid);
      await erro(db.query("SELECT * FROM public.entregador_perfil()"), "NAO_ENTREGADOR");
      await erro(db.query("SELECT * FROM public.entregador_minhas_entregas()"), "NAO_ENTREGADOR");
    }
    await as(db, CARLOS);
    await erro(db.query("SELECT * FROM public.entregador_perfil()"), "ENTREGADOR_INATIVO");
    await as(db, null, "anon");
    await erro(db.query("SELECT * FROM public.entregador_minhas_entregas()"), "permission denied");
    // Conta da equipe não vira entregador.
    await asServer(db);
    await erro(db.query(`INSERT INTO public.entregadores (id, nome, email) VALUES ('${STAFF}','Staff','s@x.com')`), "CONTA_DA_EQUIPE");
    await asOwner(db);
    assert.equal((await db.query(`SELECT email FROM public.entregadores WHERE id='${JOAO}'`)).rows[0].email, "joao@x.com");
  } finally { await db.close(); }
});

test("3: um entregador selecionado por vez; inativo não pode ser selecionado; app não seleciona", async () => {
  const db = await setup();
  try {
    await selecionar(db, JOAO);
    await selecionar(db, PEDRO);
    await asOwner(db);
    assert.deepEqual((await db.query("SELECT id FROM public.entregadores WHERE selecionado")).rows, [{ id: PEDRO }]);
    await erro(selecionar(db, CARLOS), "ENTREGADOR_INVALIDO");
    await as(db, JOAO);
    await erro(db.query("SELECT public.admin_selecionar_entregador($1)", [JOAO]), "permission denied");
    await erro(db.query("UPDATE public.entregadores SET selecionado = true"), "permission denied");
    await selecionar(db, null);
    await asOwner(db);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.entregadores WHERE selecionado")).rows[0].n, 0);
  } finally { await db.close(); }
});

test("4–5, 13: atribui só ao sair para entrega, só entrega, só com selecionado", async () => {
  const db = await setup();
  try {
    await selecionar(db, JOAO);
    const id = await novoPedido(db);
    assert.equal((await pedido(db, id)).entregador_id, null, "não atribui ao criar/preparar");
    assert.deepEqual(await minhas(db, JOAO), []);
    await mudarStatus(db, id, "saiu_entrega");
    const p = await pedido(db, id);
    assert.equal(p.entregador_id, JOAO);
    assert.ok(p.saiu_entrega_at);
    const lista = await minhas(db, JOAO);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].numero, id.slice(0, 8).toUpperCase());
    assert.deepEqual(lista[0].itens, [{ qtd: 2, nome: "Açaí 500ml", obs: "sem granola" }]);
    assert.equal(lista[0].meio_pagamento, "dinheiro");
    assert.equal(lista[0].troco_para, "50");
    assert.equal(Number(lista[0].total), 45);
    // Retirada não vai para entregador.
    const retirada = await novoPedido(db, { tipo: "retirada" });
    await mudarStatus(db, retirada, "saiu_entrega");
    assert.equal((await pedido(db, retirada)).entregador_id, null);
    // Sem selecionado: não atribui a ninguém.
    await selecionar(db, null);
    const semNinguem = await novoPedido(db);
    await mudarStatus(db, semNinguem, "saiu_entrega");
    assert.equal((await pedido(db, semNinguem)).entregador_id, null);
    assert.equal((await minhas(db, JOAO)).length, 1);
  } finally { await db.close(); }
});

test("6–7: pedido do João não aparece nem conclui para o Pedro; trocar o selecionado não transfere", async () => {
  const db = await setup();
  try {
    await selecionar(db, JOAO);
    const doJoao = await novoPedido(db);
    await mudarStatus(db, doJoao, "saiu_entrega");
    await selecionar(db, PEDRO);
    const doPedro = await novoPedido(db);
    await mudarStatus(db, doPedro, "saiu_entrega");
    assert.equal((await pedido(db, doJoao)).entregador_id, JOAO, "continua com o João");
    assert.deepEqual((await minhas(db, JOAO)).map((p) => p.id), [doJoao]);
    assert.deepEqual((await minhas(db, PEDRO)).map((p) => p.id), [doPedro]);
    await erro(concluir(db, PEDRO, doJoao), "PEDIDO_INDISPONIVEL");
    assert.equal((await pedido(db, doJoao)).status, "saiu_entrega");
    // Sem acesso direto às tabelas.
    await as(db, PEDRO);
    assert.deepEqual((await db.query("SELECT id FROM public.pedidos")).rows, [], "RLS: nada de pedidos direto");
    await erro(db.query("SELECT * FROM public.entregadores"), "permission denied");
    const upd = await db.query(`UPDATE public.pedidos SET status='entregue', entregador_id='${PEDRO}' WHERE id='${doJoao}'`);
    assert.equal(upd.affectedRows ?? 0, 0);
    assert.equal((await pedido(db, doJoao)).entregador_id, JOAO);
  } finally { await db.close(); }
});

test("8–9, 14: concluir atualiza o pedido uma única vez, registra e avisa", async () => {
  const db = await setup();
  try {
    await selecionar(db, JOAO);
    const id = await novoPedido(db);
    await mudarStatus(db, id, "saiu_entrega");
    const [a, b] = await Promise.all([concluir(db, JOAO, id), concluir(db, JOAO, id)].map((p) => p.catch((e) => e)));
    const results = [a, b].filter((r) => !(r instanceof Error));
    assert.ok(results.length >= 1);
    const again = await concluir(db, JOAO, id);
    assert.equal(again.ja_concluido, true, "segunda conclusão não altera nada");
    const p = await pedido(db, id);
    assert.equal(p.status, "entregue");
    assert.ok(p.entregue_at);
    await asOwner(db);
    const audits = (await db.query("SELECT actor_id FROM public.audit_logs WHERE action='pedido.entregue_pelo_entregador'")).rows;
    assert.deepEqual(audits, [{ actor_id: JOAO }], "uma única conclusão registrada");
    assert.deepEqual(await minhas(db, JOAO), []);
    await asOwner(db);
    const avisos = (await db.query("SELECT topic, event, payload FROM realtime.messages ORDER BY id")).rows;
    assert.ok(avisos.length >= 2);
    assert.ok(avisos.every((m) => m.topic === `entregador:${JOAO}` && m.event === "entregas_mudaram"));
    assert.deepEqual(Object.keys(avisos[0].payload), ["pedido_id"], "aviso sem dados do pedido");
  } finally { await db.close(); }
});

test("12: entregador desativado perde o acesso e deixa de ser o selecionado", async () => {
  const db = await setup();
  try {
    await selecionar(db, JOAO);
    const id = await novoPedido(db);
    await mudarStatus(db, id, "saiu_entrega");
    await asServer(db);
    await db.exec(`UPDATE public.entregadores SET ativo = false WHERE id = '${JOAO}'`);
    await erro(minhas(db, JOAO), "ENTREGADOR_INATIVO");
    await erro(concluir(db, JOAO, id), "ENTREGADOR_INATIVO");
    assert.equal((await pedido(db, id)).status, "saiu_entrega");
    await asOwner(db);
    assert.equal((await db.query(`SELECT selecionado FROM public.entregadores WHERE id='${JOAO}'`)).rows[0].selecionado, false);
  } finally { await db.close(); }
});

test("voltar para preparando desatribui; ao sair de novo vai para o selecionado da vez", async () => {
  const db = await setup();
  try {
    await selecionar(db, JOAO);
    const id = await novoPedido(db);
    await mudarStatus(db, id, "saiu_entrega");
    await mudarStatus(db, id, "preparando");
    assert.deepEqual(await pedido(db, id), { status: "preparando", entregador_id: null, saiu_entrega_at: null, entregue_at: null });
    assert.deepEqual(await minhas(db, JOAO), []);
    await selecionar(db, PEDRO);
    await mudarStatus(db, id, "saiu_entrega");
    assert.equal((await pedido(db, id)).entregador_id, PEDRO);
    // Cancelado some do app e não pode ser concluído.
    await mudarStatus(db, id, "cancelado");
    assert.deepEqual(await minhas(db, PEDRO), []);
    await erro(concluir(db, PEDRO, id), "PEDIDO_INDISPONIVEL");
    // O painel ainda marca como entregue e registra o horário.
    const outro = await novoPedido(db);
    await mudarStatus(db, outro, "saiu_entrega");
    await mudarStatus(db, outro, "entregue");
    assert.ok((await pedido(db, outro)).entregue_at);
  } finally { await db.close(); }
});

test("canal em tempo real: cada entregador ativo só ouve o próprio canal", async () => {
  const db = await setup();
  try {
    await selecionar(db, JOAO);
    const id = await novoPedido(db);
    await mudarStatus(db, id, "saiu_entrega");
    const ouvir = async (uid, topic) => {
      await as(db, uid);
      await db.query("SELECT set_config('realtime.topic', $1, false)", [topic]);
      return (await db.query("SELECT count(*)::int AS n FROM realtime.messages")).rows[0].n;
    };
    assert.ok((await ouvir(JOAO, `entregador:${JOAO}`)) > 0);
    assert.equal(await ouvir(PEDRO, `entregador:${JOAO}`), 0, "Pedro não ouve o canal do João");
    assert.equal(await ouvir(STAFF, `entregador:${JOAO}`), 0);
    await asServer(db);
    await db.exec(`UPDATE public.entregadores SET ativo = false WHERE id = '${JOAO}'`);
    assert.equal(await ouvir(JOAO, `entregador:${JOAO}`), 0, "desativado para de ouvir");
  } finally { await db.close(); }
});

test("rollback desfaz a migration sem tocar nos pedidos", async () => {
  const db = await setup();
  try {
    await selecionar(db, JOAO);
    const id = await novoPedido(db);
    await mudarStatus(db, id, "saiu_entrega");
    await asOwner(db);
    await db.exec(fs.readFileSync("supabase/rollbacks/0019_entregadores.sql", "utf8"));
    assert.equal((await db.query("SELECT to_regclass('public.entregadores') AS t")).rows[0].t, null);
    assert.equal((await db.query("SELECT status FROM public.pedidos WHERE id=$1", [id])).rows[0].status, "saiu_entrega");
    await db.query("UPDATE public.pedidos SET status='entregue' WHERE id=$1", [id]);
  } finally { await db.close(); }
});
