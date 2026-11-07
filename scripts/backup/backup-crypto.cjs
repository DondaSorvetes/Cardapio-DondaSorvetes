#!/usr/bin/env node
/**
 * Criptografia dos backups do banco (AES-256-GCM).
 *
 * O repositório é público e o backup fica como artifact do GitHub Actions, que
 * qualquer conta do GitHub consegue baixar. Por isso o arquivo só sai do runner
 * criptografado; sem a chave BACKUP_ENCRYPTION_KEY ele é inútil.
 *
 * Formato: "SSBK1\0" (6 bytes) + IV (12) + dados criptografados + tag GCM (16).
 * O painel (src/lib/backups.server.ts) lê o mesmo formato.
 *
 * Uso:
 *   node scripts/backup/backup-crypto.cjs keygen
 *   BACKUP_ENCRYPTION_KEY=... node scripts/backup/backup-crypto.cjs encrypt <entrada> <saida>
 *   BACKUP_ENCRYPTION_KEY=... node scripts/backup/backup-crypto.cjs decrypt <entrada.enc> <saida.tar.gz>
 */
const crypto = require("node:crypto");
const fs = require("node:fs");

const MAGIC = Buffer.from("SSBK1\0", "latin1");
const IV_BYTES = 12;
const TAG_BYTES = 16;

function parseKey(value) {
  const key = Buffer.from(String(value || "").trim(), "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY deve ser 32 bytes em base64 (use o comando keygen).");
  return key;
}

function encrypt(plain, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, body, cipher.getAuthTag()]);
}

function decrypt(data, key) {
  if (data.length < MAGIC.length + IV_BYTES + TAG_BYTES || !data.subarray(0, MAGIC.length).equals(MAGIC))
    throw new Error("Arquivo não é um backup criptografado do Sorvetes Donda.");
  const iv = data.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = data.subarray(data.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(MAGIC.length + IV_BYTES, data.length - TAG_BYTES)), decipher.final()]);
}

module.exports = { MAGIC, parseKey, encrypt, decrypt };

if (require.main === module) {
  const [command, input, output] = process.argv.slice(2);
  try {
    if (command === "keygen") {
      process.stdout.write(crypto.randomBytes(32).toString("base64") + "\n");
    } else if ((command === "encrypt" || command === "decrypt") && input && output) {
      const key = parseKey(process.env.BACKUP_ENCRYPTION_KEY);
      const result = (command === "encrypt" ? encrypt : decrypt)(fs.readFileSync(input), key);
      fs.writeFileSync(output, result, { mode: 0o600 });
    } else {
      console.error("Uso: backup-crypto.cjs keygen | encrypt <entrada> <saida> | decrypt <entrada> <saida>");
      process.exit(2);
    }
  } catch (error) {
    console.error(error instanceof Error && /auth|unable/i.test(error.message) ? "Chave errada ou arquivo corrompido." : error.message);
    process.exit(1);
  }
}
