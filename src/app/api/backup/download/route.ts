import { NextRequest, NextResponse } from "next/server";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { securityLog } from "@/lib/security/logger";
import {
  backupKey,
  downloadBackup,
  fetchBackupMeta,
  verifyDownloadToken,
} from "@/lib/backups.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** O link abre no navegador (inclusive a partir do app Windows): erro em página legível, não JSON. */
function errorPage(message: string, status: number) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Backup Sorvetes Donda</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F7F8FC;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827;padding:16px;box-sizing:border-box">
<main style="max-width:440px;width:100%;background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:24px">
<p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#C8285F">Backup Sorvetes Donda</p>
<h1 style="margin:0 0 8px;font-size:18px">Não foi possível baixar</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4B5563">${escape(message)}</p>
<p style="margin:0;font-size:13px;color:#6B7280">Volte ao painel em Configurações → Backup e clique em Baixar de novo.</p>
</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" },
  });
}

function logFailure(reason: string) {
  securityLog({ event: "api.error", level: "error", path: "backup:file", result: "fail", meta: { reason: reason.slice(0, 120) } });
}

/**
 * Entrega um backup já descriptografado. A autorização é o token de 60 s gerado
 * por getBackupDownloadUrl (que exige admin:manage e grava auditoria): o app
 * Windows abre o link no navegador, que não tem a sessão do painel.
 */
export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.apiStrict, checkOrigin: false },
  async (request: NextRequest) => {
    const key = backupKey();
    if (!key) return errorPage("O backup não está configurado no servidor.", 503);
    const id = verifyDownloadToken(request.nextUrl.searchParams.get("t"), key);
    if (id === null) return errorPage("Este link de download é inválido ou já expirou (vale por 60 segundos).", 403);

    let file: Buffer;
    let name: string;
    try {
      const item = await fetchBackupMeta(id);
      if (!item) return errorPage("Este backup não foi encontrado ou já expirou no GitHub.", 404);
      name = item.name;
      file = await downloadBackup(id, key);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      logFailure(reason);
      // GCM recusa a tag quando a chave da Vercel não é a mesma usada pelo GitHub Actions.
      return errorPage(
        /auth|BACKUP_FORMAT/i.test(reason)
          ? "O arquivo não abriu com a chave do servidor: a BACKUP_ENCRYPTION_KEY da Vercel é diferente da usada no GitHub."
          : "O GitHub não respondeu como esperado. Tente novamente em instantes.",
        502,
      );
    }

    // Resposta em stream: evita o limite de corpo de resposta das funções.
    const chunk = 256 * 1024;
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= file.length) return controller.close();
        controller.enqueue(new Uint8Array(file.subarray(offset, offset + chunk)));
        offset += chunk;
      },
    });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(file.length),
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
