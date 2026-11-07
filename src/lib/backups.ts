/**
 * Backups diários gerados por .github/workflows/supabase-backup.yml e guardados,
 * criptografados, como artifacts do GitHub Actions (90 dias).
 */
export const BACKUP_REPO = "DondaSorvetes/Cardapio-DondaSorvetes";
export const BACKUP_RETENTION_DAYS = 90;
/** Nome do artifact: donda-AAAA-MM-DD_HHMM (horário de Brasília). */
export const BACKUP_ARTIFACT_NAME = /^donda-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/;
/** Um backup diário atrasado mais de 26 h indica que o agendamento falhou. */
export const BACKUP_STALE_MS = 26 * 60 * 60 * 1000;

export type BackupItem = {
  /** ID do artifact no GitHub. */
  id: number;
  /** Nome do arquivo entregue no download (já descriptografado). */
  name: string;
  size: number | null;
  takenAt: string;
};

/** Data do backup a partir do nome do artifact (horário de Brasília, UTC-3). */
export function backupTakenAt(name: string): string | null {
  const m = BACKUP_ARTIFACT_NAME.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:00-03:00`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejeita datas "roladas" pelo Date (ex.: 2026-13-40).
  const back = new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString();
  return back.startsWith(`${y}-${mo}-${d}T${h}:${mi}`) ? date.toISOString() : null;
}

export function isBackupArtifactName(name: unknown): name is string {
  return typeof name === "string" && backupTakenAt(name) !== null;
}

export function backupHealth(items: BackupItem[], now = Date.now()): "ok" | "stale" | "empty" {
  if (!items.length) return "empty";
  return now - new Date(items[0].takenAt).getTime() > BACKUP_STALE_MS ? "stale" : "ok";
}

export function formatBytes(size: number | null) {
  if (size == null) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
