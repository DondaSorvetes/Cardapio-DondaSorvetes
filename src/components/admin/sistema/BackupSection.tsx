"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBackupDownloadUrl, listBackups } from "@/actions/admin/backups";
import { BACKUP_RETENTION_DAYS, backupHealth, formatBytes, type BackupItem } from "@/lib/backups";

const ACTIONS_URL =
  "https://github.com/DondaSorvetes/Cardapio-DondaSorvetes/actions/workflows/supabase-backup.yml";
const TZ = "America/Sao_Paulo";

type Notice = { message: string; reload?: boolean };

/** Ação que nem chegou a responder: em geral, painel aberto antes de uma publicação nova. */
const UNREACHABLE: Notice = {
  message: "O painel não conseguiu falar com o servidor. Ele pode ter sido atualizado: recarregue a página.",
  reload: true,
};

const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, ...options });

function dayLabel(iso: string, now: number) {
  const day = (t: number) => new Date(t).toLocaleDateString("pt-BR", { timeZone: TZ });
  const target = day(Date.parse(iso));
  if (target === day(now)) return "Hoje";
  if (target === day(now - 864e5)) return "Ontem";
  const weekday = fmt(iso, { weekday: "long" });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function ago(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} dias`;
}

/** Próxima execução agendada: 02:30 UTC (23:30 em Brasília). */
function nextRun(now: number) {
  const next = new Date(now);
  next.setUTCHours(2, 30, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  const day = (t: number) => new Date(t).toLocaleDateString("pt-BR", { timeZone: TZ });
  const when = day(next.getTime()) === day(now) ? "hoje" : "amanhã";
  return `${when} às ${fmt(next.toISOString(), { hour: "2-digit", minute: "2-digit" })}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#111827]">{value}</p>
      {hint && <p className="text-xs text-[#6B7280]">{hint}</p>}
    </div>
  );
}

export function BackupSection() {
  const [items, setItems] = useState<BackupItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [desktopApp, setDesktopApp] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const result = await listBackups();
      if (result.ok) {
        setItems(result.items);
        setConfigured(result.configured);
      } else {
        setNotice({ message: result.error });
      }
    } catch {
      setNotice(UNREACHABLE);
    } finally {
      setNow(Date.now());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDesktopApp(Boolean((window as Window & { dondaDesktop?: unknown }).dondaDesktop));
    void load();
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const download = async (id: number) => {
    setDownloading(id);
    setNotice(null);
    try {
      const result = await getBackupDownloadUrl(id);
      if (!result.ok) {
        setNotice({ message: result.error, reload: /recarregue/i.test(result.error) });
        return;
      }
      // Nova aba: no app Windows o link abre no navegador padrão, que faz o download.
      window.open(new URL(result.url, window.location.href).href, "_blank", "noopener,noreferrer");
    } catch {
      setNotice(UNREACHABLE);
    } finally {
      setDownloading(null);
    }
  };

  const health = backupHealth(items, now);
  const latest = items[0];
  const status = loading
    ? { label: "Verificando", tone: "neutral" as const }
    : !configured
      ? { label: "Não configurado", tone: "warn" as const }
      : health === "ok"
        ? { label: "Em dia", tone: "ok" as const }
        : health === "stale"
          ? { label: "Atrasado", tone: "warn" as const }
          : { label: "Sem backups", tone: "neutral" as const };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="mb-1 text-lg font-semibold text-[#111827]">Backup</h2>
          <p className="text-sm text-[#6B7280]">
            Cópia completa do banco de dados, feita todos os dias às 23:30 e guardada criptografada no GitHub por{" "}
            {BACKUP_RETENTION_DAYS} dias.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-9 gap-1.5" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
          Atualizar
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                status.tone === "ok" && "bg-emerald-50 text-emerald-700",
                status.tone === "warn" && "bg-amber-50 text-amber-800",
                status.tone === "neutral" && "bg-[#F3F4F6] text-[#4B5563]",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status.tone === "ok" && "bg-emerald-500",
                  status.tone === "warn" && "bg-amber-500",
                  status.tone === "neutral" && "bg-[#9CA3AF]",
                )}
                aria-hidden="true"
              />
              {status.label}
            </span>
            <p className="mt-2 text-sm text-[#6B7280]">Último backup</p>
            {loading ? (
              <div className="mt-1 h-6 w-56 animate-pulse rounded bg-[#F3F4F6]" />
            ) : latest ? (
              <p className="text-lg font-semibold text-[#111827]">
                {dayLabel(latest.takenAt, now)}, {fmt(latest.takenAt, { day: "2-digit", month: "2-digit" })} às{" "}
                {fmt(latest.takenAt, { hour: "2-digit", minute: "2-digit" })}
                <span className="ml-2 text-sm font-normal text-[#6B7280]">{ago(latest.takenAt, now)}</span>
              </p>
            ) : (
              <p className="text-lg font-semibold text-[#111827]">Nenhum ainda</p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-[#6B7280]">Próximo automático</p>
            <p className="text-base font-semibold text-[#111827]">{nextRun(now)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[#F3F4F6] border-t border-[#F3F4F6] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Stat label="Guardados" value={loading ? "—" : String(items.length)} hint={items.length === 1 ? "backup" : "backups"} />
          <Stat label="Retenção" value={`${BACKUP_RETENTION_DAYS} dias`} hint="os mais antigos expiram sozinhos" />
          <Stat label="Proteção" value="Criptografado" hint="AES-256, só o painel abre" />
        </div>
      </div>

      {notice && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3"
        >
          <p className="text-sm text-[#B42318]">{notice.message}</p>
          {notice.reload && (
            <Button type="button" variant="outline" className="h-8 bg-white text-xs" onClick={() => window.location.reload()}>
              Recarregar painel
            </Button>
          )}
        </div>
      )}

      {!loading && !notice && (!configured || health === "stale") && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {configured
            ? "O backup da última noite não chegou. Confira a execução no GitHub Actions."
            : "Backup não configurado no servidor: faltam BACKUP_ENCRYPTION_KEY e GITHUB_BACKUP_TOKEN na Vercel."}{" "}
          <a href={ACTIONS_URL} target="_blank" rel="noreferrer" className="font-semibold underline">
            Abrir GitHub Actions
          </a>
        </p>
      )}

      <section aria-labelledby="backup-list">
        <h3 id="backup-list" className="mb-2 text-sm font-semibold text-[#111827]">
          Backups guardados
        </h3>
        <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
          <div className="hidden grid-cols-[1fr_120px_120px] gap-4 border-b border-[#F3F4F6] bg-[#F9FAFB] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#9CA3AF] sm:grid">
            <span>Data</span>
            <span>Tamanho</span>
            <span className="text-right">Arquivo</span>
          </div>
          {loading ? (
            <ul className="divide-y divide-[#F3F4F6]" aria-label="Carregando backups">
              {[0, 1, 2].map((row) => (
                <li key={row} className="flex items-center justify-between px-4 py-3.5">
                  <div className="space-y-1.5">
                    <div className="h-4 w-44 animate-pulse rounded bg-[#F3F4F6]" />
                    <div className="h-3 w-24 animate-pulse rounded bg-[#F3F4F6]" />
                  </div>
                  <div className="h-8 w-20 animate-pulse rounded bg-[#F3F4F6]" />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-[#111827]">Nenhum backup guardado</p>
              <p className="mt-1 text-sm text-[#6B7280]">O próximo será feito {nextRun(now)}.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[1fr_120px_120px]"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#111827]">
                      {fmt(item.takenAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
                      <span className="text-[#6B7280]">{fmt(item.takenAt, { hour: "2-digit", minute: "2-digit" })}</span>
                      {index === 0 && (
                        <span className="rounded-full bg-[#FDF0F4] px-2 py-0.5 text-[11px] font-semibold text-[#C8285F]">
                          Mais recente
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      {dayLabel(item.takenAt, now)} · {ago(item.takenAt, now)}
                      <span className="sm:hidden"> · {formatBytes(item.size)}</span>
                    </p>
                  </div>
                  <span className="hidden text-sm tabular-nums text-[#4B5563] sm:block">{formatBytes(item.size)}</span>
                  <div className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      disabled={downloading !== null}
                      onClick={() => void download(item.id)}
                      aria-label={`Baixar backup de ${fmt(item.takenAt, { dateStyle: "short", timeStyle: "short" })}`}
                    >
                      {downloading === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Baixar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 space-y-1 text-xs text-[#6B7280]">
          {desktopApp && <p>No aplicativo Windows, o download abre no navegador padrão e o arquivo vai para Downloads.</p>}
          <p>
            O arquivo baixado já vem aberto (.tar.gz) e traz as instruções de restauração em RESTAURAR.txt. As imagens do
            cardápio não fazem parte do backup do banco.
          </p>
        </div>
      </section>
    </div>
  );
}
