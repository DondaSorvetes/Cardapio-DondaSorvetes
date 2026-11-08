/**
 * Migration 0025 (inscrições de notificação) num Postgres em memória (PGlite):
 * só o servidor (service_role) lê e grava; anon e authenticated não enxergam
 * nada; endpoint é único; apagar o usuário apaga as inscrições; rollback limpa.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

const USER = "00000000-0000-4000-8000-0000000000a1";

test("inscrições de push: fechadas para o público, abertas só ao servidor", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      INSERT INTO auth.users VALUES ('${USER}');`);
    const migration = fs.readFileSync("supabase/migrations/0025_admin_push_subscriptions.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration); // idempotente

    await db.exec("SET ROLE service_role");
    await db.query(
      "INSERT INTO public.admin_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'k', 'a')",
      [USER, "https://fcm.googleapis.com/x"],
    );
    await assert.rejects(
      db.query("INSERT INTO public.admin_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'k', 'a')", [USER, "https://fcm.googleapis.com/x"]),
      /duplicate key/,
    );
    await assert.rejects(
      db.query("INSERT INTO public.admin_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'k', 'a')", [USER, "x".repeat(1001)]),
      /check constraint/,
    );
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.admin_push_subscriptions")).rows[0].n, 1);

    for (const role of ["anon", "authenticated"]) {
      await db.exec(`RESET ROLE; SET ROLE ${role}`);
      await assert.rejects(db.query("SELECT * FROM public.admin_push_subscriptions"), /permission denied/, role);
      await assert.rejects(
        db.query("INSERT INTO public.admin_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, 'https://fcm.googleapis.com/y', 'k', 'a')", [USER]),
        /permission denied/,
        role,
      );
    }

    await db.exec("RESET ROLE");
    await db.query("DELETE FROM auth.users WHERE id = $1", [USER]);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.admin_push_subscriptions")).rows[0].n, 0, "cascade");

    await db.exec(fs.readFileSync("supabase/rollbacks/0025_admin_push_subscriptions.sql", "utf8"));
    assert.equal((await db.query("SELECT to_regclass('public.admin_push_subscriptions') AS t")).rows[0].t, null);
  } finally {
    await db.close();
  }
});
