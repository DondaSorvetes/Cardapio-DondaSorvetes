const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

// Extract the matcher pattern from src/middleware.ts and mirror Next's anchoring.
const source = fs.readFileSync("src/middleware.ts", "utf8");
const raw = source.match(/matcher:\s*\[[\s\S]*?"(\/\(\(\?![^"]+)"/)[1];
const pattern = new RegExp("^" + raw.replace(/\\/g, "\\").replace(/^\//, "\/").replace(/:path\*/g, "") + "$");
const runs = (path) => pattern.test(path);

test("public image proxy and health skip the auth middleware", () => {
  assert.equal(runs("/api/imagem/arquivo"), false);
  assert.equal(runs("/api/imagem"), false);
  assert.equal(runs("/api/health"), false);
  assert.equal(runs("/_next/image"), false);
});

test("session-bound routes still run the middleware", () => {
  for (const path of ["/", "/pedidos", "/admin", "/api/pedidos/listar", "/api/cardapio", "/api/auth/entrar", "/api/imagemx", "/api/healthz"])
    assert.equal(runs(path), true, path);
});
