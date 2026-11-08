/**
 * Migration 0025 (limites de tempo) num Postgres em memória (PGlite): grava os
 * limites nos papéis certos, não mexe em anon/authenticated, pode rodar de novo
 * e o rollback volta ao estado anterior.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

const settings = async (db) =>
  Object.fromEntries(
    (
      await db.query(`
        SELECT COALESCE(r.rolname, '(banco)') AS alvo, s.setconfig
        FROM pg_db_role_setting s
        LEFT JOIN pg_roles r ON r.oid = s.setrole
        WHERE s.setdatabase = 0 OR s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
        ORDER BY 1`)
    ).rows.map((row) => [row.alvo, [...row.setconfig].sort()]),
  );

test("0025 limita service_role e transações ociosas; rollback restaura", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE authenticator; CREATE ROLE service_role BYPASSRLS;
      ALTER ROLE anon SET statement_timeout = '3s';
      ALTER ROLE authenticated SET statement_timeout = '8s';`);
    const antes = await settings(db);
    const migration = fs.readFileSync("supabase/migrations/0025_limites_conexoes.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration); // idempotente

    const depois = await settings(db);
    assert.deepEqual(depois.service_role, [
      "idle_in_transaction_session_timeout=30s",
      "lock_timeout=5s",
      "statement_timeout=15s",
    ]);
    assert.deepEqual(depois.authenticator, ["idle_in_transaction_session_timeout=30s"]);
    assert.deepEqual(depois["(banco)"], ["idle_in_transaction_session_timeout=60s"]);
    assert.deepEqual(depois.anon, antes.anon, "anon mantém o padrão do Supabase");
    assert.deepEqual(depois.authenticated, antes.authenticated);

    // Os valores são válidos para o Postgres. (O PGlite roda numa thread só e não
    // dispara timeouts, então o cancelamento em si não é testável aqui.)
    await db.exec("SET statement_timeout = '15s'; SET lock_timeout = '5s'; SET idle_in_transaction_session_timeout = '30s'");
    assert.equal((await db.query("SHOW statement_timeout")).rows[0].statement_timeout, "15s");
    await db.exec("RESET statement_timeout; RESET lock_timeout; RESET idle_in_transaction_session_timeout");

    await db.exec(fs.readFileSync("supabase/rollbacks/0025_limites_conexoes.sql", "utf8"));
    assert.deepEqual(await settings(db), antes);
  } finally {
    await db.close();
  }
});
