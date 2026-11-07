"use server";

import { requirePermission } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/security/audit";
import { securityLog } from "@/lib/security/logger";
import type { BackupItem } from "@/lib/backups";
import {
  backupConfigured,
  backupKey,
  fetchBackupList,
  fetchBackupMeta,
  signDownloadToken,
} from "@/lib/backups.server";

/*
 * Backups contêm todos os dados da loja (inclusive dados pessoais de clientes):
 * listagem e download ficam restritos ao administrador (admin:manage).
 *
 * As ações devolvem { ok: false, error } em vez de lançar exceção: em produção o
 * Next.js troca a mensagem de qualquer erro lançado por um texto genérico
 * ("An error occurred in the Server Components render…").
 */
type Fail = { ok: false; error: string };
export type ListBackupsResult = { ok: true; configured: boolean; items: BackupItem[] } | Fail;
export type BackupDownloadResult = { ok: true; url: string } | Fail;

const STALE_PANEL = "O painel foi atualizado. Recarregue a página (F5) e tente de novo.";

async function admin() {
  try {
    return await requirePermission("admin:manage");
  } catch {
    return null;
  }
}

function logFailure(action: string, error: unknown) {
  securityLog({
    event: "api.error",
    level: "error",
    path: `backup:${action}`,
    result: "fail",
    meta: { reason: error instanceof Error ? error.message.slice(0, 120) : "unknown" },
  });
}

export async function listBackups(): Promise<ListBackupsResult> {
  if (!(await admin())) return { ok: false, error: "Apenas o administrador pode ver os backups." };
  if (!backupConfigured()) return { ok: true, configured: false, items: [] };
  try {
    return { ok: true, configured: true, items: await fetchBackupList() };
  } catch (error) {
    logFailure("list", error);
    const status = error instanceof Error ? /GITHUB_(\d+)/.exec(error.message)?.[1] : undefined;
    return {
      ok: false,
      error:
        status === "401" || status === "403"
          ? "O GitHub recusou o token de acesso aos backups (GITHUB_BACKUP_TOKEN). Confira se ele está válido e aprovado."
          : "Não foi possível consultar os backups no GitHub. Tente novamente em instantes.",
    };
  }
}

/** Link de download temporário (60 s) para um backup específico. */
export async function getBackupDownloadUrl(id: unknown): Promise<BackupDownloadResult> {
  const user = await admin();
  if (!user) return { ok: false, error: "Apenas o administrador pode baixar backups." };
  // Versão antiga do painel (antes dos backups no GitHub) enviava o nome do arquivo.
  if (typeof id !== "number") return { ok: false, error: STALE_PANEL };
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: "Backup inválido." };
  const key = backupKey();
  if (!key || !backupConfigured()) return { ok: false, error: "Backup não configurado no servidor." };
  let item: BackupItem | null;
  try {
    item = await fetchBackupMeta(id);
  } catch (error) {
    logFailure("download", error);
    return { ok: false, error: "Não foi possível consultar o backup no GitHub. Tente novamente em instantes." };
  }
  if (!item) return { ok: false, error: "Backup não encontrado ou já expirou. Atualize a lista." };
  await writeAudit({
    actorId: user.admin.id,
    actorEmail: user.admin.email,
    action: "backup.download",
    entity: "backup",
    entityId: item.name,
  });
  return { ok: true, url: `/api/backup/download?t=${encodeURIComponent(signDownloadToken(id, key))}` };
}
