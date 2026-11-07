import "server-only";
import crypto from "node:crypto";
import zlib from "node:zlib";
import {
  BACKUP_REPO,
  backupTakenAt,
  isBackupArtifactName,
  type BackupItem,
} from "@/lib/backups";

/**
 * Lado servidor dos backups: lista os artifacts no GitHub, baixa, abre o .zip do
 * artifact e descriptografa (mesmo formato de scripts/backup/backup-crypto.cjs).
 *
 * Variáveis de ambiente (Vercel):
 *   BACKUP_ENCRYPTION_KEY  mesma chave do secret do GitHub (32 bytes em base64)
 *   GITHUB_BACKUP_TOKEN    token do GitHub com leitura de Actions neste repositório
 */
const MAGIC = Buffer.from("SSBK1\0", "latin1");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const API = `https://api.github.com/repos/${BACKUP_REPO}/actions`;
/** Validade do link de download gerado pelo painel. */
export const DOWNLOAD_TOKEN_TTL_MS = 60_000;

export function backupKey(value = process.env.BACKUP_ENCRYPTION_KEY): Buffer | null {
  const key = Buffer.from(String(value ?? "").trim(), "base64");
  return key.length === 32 ? key : null;
}

export function backupConfigured() {
  return backupKey() !== null && Boolean(process.env.GITHUB_BACKUP_TOKEN);
}

export function decryptBackup(data: Buffer, key: Buffer): Buffer {
  if (data.length < MAGIC.length + IV_BYTES + TAG_BYTES || !data.subarray(0, MAGIC.length).equals(MAGIC))
    throw new Error("BACKUP_FORMAT");
  const iv = data.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(data.subarray(data.length - TAG_BYTES));
  return Buffer.concat([
    decipher.update(data.subarray(MAGIC.length + IV_BYTES, data.length - TAG_BYTES)),
    decipher.final(),
  ]);
}

/** Extrai o único arquivo de um .zip de artifact do GitHub (sem ZIP64). */
export function extractSingleZipEntry(zip: Buffer): { name: string; data: Buffer } {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP_FORMAT");
  if (zip.readUInt16LE(eocd + 10) !== 1) throw new Error("ZIP_ENTRIES");
  const cd = zip.readUInt32LE(eocd + 16);
  if (cd + 46 > zip.length || zip.readUInt32LE(cd) !== 0x02014b50) throw new Error("ZIP_FORMAT");
  const method = zip.readUInt16LE(cd + 10);
  const compressed = zip.readUInt32LE(cd + 20);
  const size = zip.readUInt32LE(cd + 24);
  const nameLength = zip.readUInt16LE(cd + 28);
  const local = zip.readUInt32LE(cd + 42);
  if (compressed === 0xffffffff || size === 0xffffffff || local === 0xffffffff) throw new Error("ZIP64");
  const name = zip.subarray(cd + 46, cd + 46 + nameLength).toString("utf8");
  if (local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50) throw new Error("ZIP_FORMAT");
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const raw = zip.subarray(start, start + compressed);
  if (raw.length !== compressed) throw new Error("ZIP_FORMAT");
  const data = method === 0 ? Buffer.from(raw) : method === 8 ? zlib.inflateRawSync(raw) : null;
  if (!data || data.length !== size) throw new Error("ZIP_FORMAT");
  return { name, data };
}

type GithubArtifact = {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
  workflow_run?: { head_branch?: string; repository_id?: number; head_repository_id?: number } | null;
};

function github(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_BACKUP_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "donda-backups",
    },
  });
}

/**
 * Só vale artifact com o nome esperado, ainda disponível e gerado na branch main
 * do próprio repositório (PRs de forks também criam artifacts aqui). A tag GCM
 * ainda garante que o conteúdo foi gerado com a nossa chave.
 */
function isOurBackup(a: GithubArtifact) {
  const run = a.workflow_run;
  return (
    !a.expired &&
    isBackupArtifactName(a.name) &&
    run?.head_branch === "main" &&
    run.repository_id != null &&
    run.repository_id === run.head_repository_id
  );
}

function toItem(a: GithubArtifact): BackupItem {
  return { id: a.id, name: `${a.name}.tar.gz`, size: a.size_in_bytes ?? null, takenAt: backupTakenAt(a.name)! };
}

export async function fetchBackupList(): Promise<BackupItem[]> {
  const items: BackupItem[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await github(`/artifacts?per_page=100&page=${page}`);
    if (!res.ok) throw new Error(`GITHUB_${res.status}`);
    const body = (await res.json()) as { artifacts?: GithubArtifact[] };
    const artifacts = body.artifacts ?? [];
    items.push(...artifacts.filter(isOurBackup).map(toItem));
    if (artifacts.length < 100) break;
  }
  return items.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

export async function fetchBackupMeta(id: number): Promise<BackupItem | null> {
  const res = await github(`/artifacts/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GITHUB_${res.status}`);
  const artifact = (await res.json()) as GithubArtifact;
  return isOurBackup(artifact) ? toItem(artifact) : null;
}

/** Baixa o artifact, abre o .zip e devolve o .tar.gz descriptografado. */
export async function downloadBackup(id: number, key: Buffer): Promise<Buffer> {
  // O GitHub responde com redirect para um link temporário de outro domínio:
  // segue manualmente para não reenviar o token para lá.
  const res = await github(`/artifacts/${id}/zip`, { redirect: "manual" });
  const location = res.headers.get("location");
  if (res.status !== 302 || !location) throw new Error(`GITHUB_${res.status}`);
  const file = await fetch(location, { cache: "no-store" });
  if (!file.ok) throw new Error(`GITHUB_BLOB_${file.status}`);
  const { name, data } = extractSingleZipEntry(Buffer.from(await file.arrayBuffer()));
  if (!/\.tar\.gz\.enc$/.test(name)) throw new Error("ZIP_ENTRY_NAME");
  return decryptBackup(data, key);
}

/* Link de download de curta duração: o app Windows abre downloads no navegador,
 * que não tem a sessão do painel; o token assinado substitui a sessão por 60 s. */
function tokenKey(key: Buffer) {
  return Buffer.from(crypto.hkdfSync("sha256", key, Buffer.alloc(0), "donda-backup-download", 32));
}

export function signDownloadToken(id: number, key: Buffer, now = Date.now()) {
  const payload = `${id}.${now + DOWNLOAD_TOKEN_TTL_MS}`;
  const sig = crypto.createHmac("sha256", tokenKey(key)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDownloadToken(token: unknown, key: Buffer, now = Date.now()): number | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const m = /^(\d{1,15})\.(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return null;
  const expected = crypto.createHmac("sha256", tokenKey(key)).update(`${m[1]}.${m[2]}`).digest();
  const given = Buffer.from(m[3], "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  if (Number(m[2]) < now) return null;
  return Number(m[1]);
}
