"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Estado enviado pelo app Windows (desktop/updater.cjs). */
export type DesktopUpdateState = {
  status: "idle" | "disabled" | "checking" | "downloading" | "downloaded" | "up-to-date" | "error";
  version: string;
  available: string | null;
  progress: number | null;
  notes: string;
  releaseDate: string | null;
  checkedAt: string | null;
  error: string | null;
};
type UpdatesBridge = {
  getState: () => Promise<DesktopUpdateState>;
  check: () => Promise<DesktopUpdateState>;
  install: () => Promise<unknown>;
  onStatus: (callback: (state: DesktopUpdateState) => void) => () => void;
};
type DesktopBridge = { version?: string; updates?: UpdatesBridge };

const RELEASES_URL = "https://github.com/DondaSorvetes/Cardapio-DondaSorvetes/releases/latest";
const bridge = () => (window as Window & { dondaDesktop?: DesktopBridge }).dondaDesktop;

const STATUS_TEXT: Record<DesktopUpdateState["status"], string> = {
  idle: "Clique em Verificar agora para procurar uma nova versão",
  disabled: "Indisponível nesta instalação",
  checking: "Verificando…",
  downloading: "Baixando atualização",
  downloaded: "Atualização pronta para instalar",
  "up-to-date": "Você está na versão mais recente",
  error: "Não foi possível verificar",
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3.5", !last && "border-b border-[#F3F4F6]")}>
      <span className="text-sm text-[#6B7280]">{label}</span>
      <span className="text-right text-sm font-medium text-[#111827]">{children}</span>
    </div>
  );
}

export function AtualizacoesSection() {
  const [desktop, setDesktop] = useState<DesktopBridge | null | undefined>(undefined);
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const api = bridge() ?? null;
    setDesktop(api);
    if (!api?.updates) return;
    void api.updates.getState().then(setState).catch(() => {});
    return api.updates.onStatus(setState);
  }, []);

  const check = useCallback(async () => {
    const api = bridge()?.updates;
    if (!api) return;
    setBusy(true);
    setError("");
    try {
      setState(await api.check());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível verificar.");
    } finally {
      setBusy(false);
    }
  }, []);

  const install = useCallback(async () => {
    setError("");
    try {
      await bridge()?.updates?.install();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível instalar.");
    }
  }, []);

  const webVersion = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-lg font-semibold text-[#111827]">Atualizações</h2>
        <p className="mb-3 text-sm text-[#6B7280]">
          O painel é atualizado automaticamente a cada publicação. O aplicativo Windows só procura uma nova versão
          quando você clica em Verificar agora.
        </p>
      </div>

      <section aria-labelledby="updates-desktop">
        <h3 id="updates-desktop" className="mb-2 text-sm font-semibold text-[#111827]">
          Aplicativo Windows
        </h3>
        {desktop === undefined ? null : desktop?.updates && state ? (
          <div className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
            <Row label="Versão instalada">{state.version || desktop.version || "—"}</Row>
            <Row label="Situação">
              <span
                className={cn(
                  state.status === "up-to-date" && "text-emerald-700",
                  state.status === "downloaded" && "text-[#C8285F]",
                  state.status === "error" && "text-[#B42318]",
                )}
              >
                {STATUS_TEXT[state.status]}
                {state.available && (state.status === "downloading" || state.status === "downloaded")
                  ? ` · ${state.available}`
                  : ""}
              </span>
            </Row>
            {state.status === "downloading" && (
              <div className="border-b border-[#F3F4F6] px-4 pb-3.5">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-[#FDF0F4]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={state.progress ?? 0}
                  aria-label="Download da atualização"
                >
                  <div className="h-full rounded-full bg-[#C8285F] transition-[width]" style={{ width: `${state.progress ?? 0}%` }} />
                </div>
              </div>
            )}
            {state.error && state.status === "error" && <Row label="Detalhe">{state.error}</Row>}
            <Row label="Última verificação" last>
              {when(state.checkedAt) ?? "—"}
            </Row>
          </div>
        ) : desktop ? (
          <p className="rounded-md border border-[#E5E7EB] bg-white px-4 py-3.5 text-sm text-[#6B7280]">
            Esta versão do aplicativo ({desktop.version || "anterior à 1.2.0"}) não se atualiza sozinha. Instale a
            versão mais recente uma vez; a partir dela, as próximas chegam automaticamente.{" "}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="font-semibold text-[#C8285F] hover:underline">
              Baixar instalador
            </a>
          </p>
        ) : (
          <p className="rounded-md border border-[#E5E7EB] bg-white px-4 py-3.5 text-sm text-[#6B7280]">
            Você está no navegador. Para impressão direta e atualização automática, use o aplicativo Windows.{" "}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="font-semibold text-[#C8285F] hover:underline">
              Baixar instalador
            </a>
          </p>
        )}

        {desktop?.updates && state && (
          <div className="mt-3 flex flex-wrap gap-2">
            {state.status === "downloaded" ? (
              <Button type="button" onClick={() => void install()} className="h-9 bg-[#C8285F] hover:bg-[#A51F50]">
                Reiniciar e atualizar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => void check()}
                disabled={busy || state.status === "checking" || state.status === "downloading" || state.status === "disabled"}
                className="h-9"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Verificar agora
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-[#B42318]">
            {error}
          </p>
        )}
        {state?.notes && (state.status === "downloading" || state.status === "downloaded") && (
          <div className="mt-4">
            <h4 className="mb-1.5 text-sm font-semibold text-[#111827]">Novidades da versão {state.available}</h4>
            <p className="whitespace-pre-line rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-sm leading-relaxed text-[#4B5563]">
              {state.notes}
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="updates-web">
        <h3 id="updates-web" className="mb-2 text-sm font-semibold text-[#111827]">
          Painel web
        </h3>
        <div className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
          <Row label="Publicação em uso">{webVersion ? <code className="text-xs">{webVersion}</code> : "—"}</Row>
          <Row label="Como atualiza" last>
            Automaticamente a cada merge na main
          </Row>
        </div>
      </section>
    </div>
  );
}
