const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const ts = require("typescript");

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const out = ts.transpileModule(fs.readFileSync(path.resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const req = (name) => (name in mocks ? mocks[name] : require(name));
  new Function("require", "module", "exports", out)(req, mod, mod.exports);
  return mod.exports;
}
const lib = load("src/lib/backups.ts");
const server = load("src/lib/backups.server.ts", { "server-only": {}, "@/lib/backups": lib });
const cli = require("../backup/backup-crypto.cjs");
const key = crypto.randomBytes(32);

/** Zip com um único arquivo, como o artifact do GitHub (CRC não é conferido: a tag GCM já autentica). */
function zipOne(name, data, deflate) {
  const body = deflate ? zlib.deflateRawSync(data) : data;
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8);
  local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(deflate ? 8 : 0, 10);
  central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = local.length + n.length + body.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + n.length, 12); eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, n, body, central, n, eocd]);
}

test("artifact names map to their São Paulo timestamp and reject anything else", () => {
  assert.equal(lib.backupTakenAt("donda-2026-11-03_2330"), "2026-11-04T02:30:00.000Z");
  for (const bad of ["donda-2026-11-03_2330.tar.gz", "../donda-2026-11-03_2330", "outro", "donda-2026-13-40_9999", "donda-2026-02-30_1200", "", null])
    assert.equal(lib.isBackupArtifactName(bad), false, String(bad));
});

test("health flags a missing daily backup after 26 hours", () => {
  const items = [{ id: 1, name: "a", size: 1, takenAt: "2026-11-04T02:30:00.000Z" }];
  assert.equal(lib.backupHealth([], Date.now()), "empty");
  assert.equal(lib.backupHealth(items, Date.parse("2026-11-05T02:00:00Z")), "ok");
  assert.equal(lib.backupHealth(items, Date.parse("2026-11-05T05:00:00Z")), "stale");
  assert.equal(lib.formatBytes(1536), "1,5 KB");
});

test("workflow encrypts and verifies before uploading, and never uploads the plain dump", () => {
  const yml = fs.readFileSync(".github/workflows/supabase-backup.yml", "utf8").replace(/\r\n/g, "\n");
  assert.match(yml, /cron: "30 2 \* \* \*"/);
  assert.match(yml, /github\.ref == 'refs\/heads\/main'/);
  const encrypt = yml.indexOf("backup-crypto.cjs encrypt");
  const upload = yml.indexOf("actions/upload-artifact");
  assert.ok(encrypt > 0 && upload > encrypt, "encrypt must run before upload");
  assert.match(yml.slice(encrypt, upload), /backup-crypto\.cjs decrypt[\s\S]*cmp [\s\S]*rm -rf "\$plain"/);
  assert.match(yml.slice(upload), /path: .*\/upload\/donda-\$\{\{ env\.STAMP \}\}\.tar\.gz\.enc\n/);
  assert.match(yml, /retention-days: 90/);
  assert.doesNotMatch(yml, /gh release|actions\/cache|SUPABASE_SERVICE_ROLE_KEY|storage\/v1/);
});

test("workflow encryption (cjs) and panel decryption (server) use the same format", () => {
  const plain = crypto.randomBytes(5000);
  const enc = cli.encrypt(plain, key);
  assert.ok(!enc.includes(plain.subarray(0, 64)));
  assert.deepEqual(server.decryptBackup(enc, key), plain);
  assert.deepEqual(cli.decrypt(enc, key), plain);
  assert.throws(() => server.decryptBackup(enc, crypto.randomBytes(32)));
  const tampered = Buffer.from(enc); tampered[40] ^= 1;
  assert.throws(() => server.decryptBackup(tampered, key));
  assert.throws(() => server.decryptBackup(Buffer.from("not a backup"), key), /BACKUP_FORMAT/);
  assert.equal(server.backupKey(key.toString("base64")).length, 32);
  assert.equal(server.backupKey("curta"), null);
});

test("artifact zip is opened (stored and deflated) and malformed zips are rejected", () => {
  const data = cli.encrypt(Buffer.from("conteudo"), key);
  for (const deflate of [false, true]) {
    const out = server.extractSingleZipEntry(zipOne("donda-2026-11-04_1052.tar.gz.enc", data, deflate));
    assert.equal(out.name, "donda-2026-11-04_1052.tar.gz.enc");
    assert.deepEqual(out.data, data);
  }
  assert.throws(() => server.extractSingleZipEntry(Buffer.from("PK nada")), /ZIP/);
  const truncated = zipOne("x.enc", data, false);
  assert.throws(() => server.extractSingleZipEntry(truncated.subarray(0, truncated.length - 30)));
});

test("download token is bound to the artifact, signed and expires in 60 s", () => {
  const now = Date.parse("2026-11-04T14:00:00Z");
  const token = server.signDownloadToken(123, key, now);
  assert.equal(server.verifyDownloadToken(token, key, now + 59_000), 123);
  assert.equal(server.verifyDownloadToken(token, key, now + 61_000), null);
  assert.equal(server.verifyDownloadToken(token, crypto.randomBytes(32), now), null);
  assert.equal(server.verifyDownloadToken(token.replace(/^123\./, "124."), key, now), null);
  for (const bad of [null, "", "123", `${token}x`, "a".repeat(500)]) assert.equal(server.verifyDownloadToken(bad, key, now), null);
});

test("panel actions require the administrator, never throw, and the route checks the token first", () => {
  const actions = fs.readFileSync("src/actions/admin/backups.ts", "utf8");
  assert.match(actions, /requirePermission\("admin:manage"\)/);
  for (const fn of ["listBackups", "getBackupDownloadUrl"]) {
    const body = actions.slice(actions.indexOf(`export async function ${fn}`)).split(/\nexport /)[0];
    assert.match(body, /if \(!\(?(await admin\(\)|user)\)?\) return \{ ok: false/, `${fn} checks admin first`);
    // Em produção o Next.js esconde a mensagem de erros lançados em Server Actions.
    assert.doesNotMatch(body, /throw /, `${fn} must return { ok: false, error } instead of throwing`);
  }
  assert.match(actions, /typeof id !== "number"\) return \{ ok: false, error: STALE_PANEL \}/, "old panel sending a file name gets a reload hint");
  assert.match(actions, /writeAudit\(/);
  const panel = fs.readFileSync("src/components/admin/sistema/BackupSection.tsx", "utf8");
  assert.match(panel, /window\.location\.reload\(\)/);
  const route = fs.readFileSync("src/app/api/backup/download/route.ts", "utf8");
  assert.ok(route.indexOf("verifyDownloadToken(") < route.indexOf("downloadBackup(id"));
  assert.match(route, /no-store/);
  assert.match(route, /escape\(message\)/, "error page escapes its message");
  const serverSrc = fs.readFileSync("src/lib/backups.server.ts", "utf8");
  assert.match(serverSrc, /redirect: "manual"/, "token must not follow the redirect to the blob host");
  assert.match(serverSrc, /head_branch === "main"/);
});
