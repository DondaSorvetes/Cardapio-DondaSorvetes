/**
 * Cria (ou promove) um usuário administrador do painel.
 *
 * Uso:
 *   node scripts/criar-admin.cjs <email> <senha> ["Nome"]
 *
 * - Cria a conta no Supabase Auth já com e-mail confirmado (login liberado na hora).
 * - Se a conta já existir, atualiza a senha e confirma o e-mail.
 * - Cria/atualiza a linha em public.perfis com role = 'admin'.
 * Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local.
 */
const fs = require("fs");
const path = require("path");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const [email, senha, nome = "Administrador"] = process.argv.slice(2);
if (!email || !senha) {
  console.error('Uso: node scripts/criar-admin.cjs <email> <senha> ["Nome"]');
  process.exit(1);
}

async function call(method, url, body, extra = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(`${method} ${url}: ${res.status} ${text}`), { status: res.status, data });
  return data;
}

async function acharUsuario(alvo) {
  for (let page = 1; page < 50; page++) {
    const { users } = await call("GET", `/auth/v1/admin/users?page=${page}&per_page=200`);
    const u = users.find((x) => x.email?.toLowerCase() === alvo.toLowerCase());
    if (u || users.length < 200) return u ?? null;
  }
  return null;
}

async function main() {
  let user = await acharUsuario(email);
  if (user) {
    user = await call("PUT", `/auth/v1/admin/users/${user.id}`, { password: senha, email_confirm: true });
    console.log("Conta já existia: senha atualizada e e-mail confirmado.");
  } else {
    user = await call("POST", "/auth/v1/admin/users", {
      email, password: senha, email_confirm: true, user_metadata: { nome },
    });
    console.log("Conta criada no Supabase Auth.");
  }

  await call(
    "POST",
    "/rest/v1/perfis?on_conflict=id",
    { id: user.id, nome, email, role: "admin", acessos: null },
    { Prefer: "resolution=merge-duplicates,return=minimal" },
  );

  const [perfil] = await call("GET", `/rest/v1/perfis?id=eq.${user.id}&select=role,email`);
  console.log(`OK: ${perfil.email} é ${perfil.role} (id ${user.id}).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
