"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRinging, BellSlash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getPushStatus,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/actions/admin/push";
import {
  currentSubscription,
  panelRegistration,
  pushSupport,
  subscribeDevice,
  type PushSupport,
} from "@/lib/pwa/push";

type State =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "not-configured"
  | "denied"
  | "off"
  | "on";

const BANNER_KEY = "donda-push-banner-fechado";

function readDismissed() {
  try {
    return localStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

function usePush() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  // Vem do servidor em tempo de execução (não depende do build).
  const [publicKey, setPublicKey] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const support: PushSupport = pushSupport();
    if (support !== "supported") return setState(support);
    try {
      const status = await getPushStatus();
      setProblems(status.problems);
      if (!status.configured || !status.publicKey) return setState("not-configured");
      setPublicKey(status.publicKey);
      if (Notification.permission === "denied") return setState("denied");
      if (!(await panelRegistration())) return setState("unsupported");
      const subscription = await currentSubscription();
      if (subscription) {
        // Mantém a inscrição ligada à conta que está usando o aparelho agora.
        void savePushSubscription(subscription.toJSON()).catch(() => {});
        return setState("on");
      }
      setState("off");
    } catch {
      setState("unsupported");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const subscription = await subscribeDevice(publicKey);
      await savePushSubscription(subscription.toJSON());
      setState("on");
      toast.success("Notificações ativadas neste aparelho.");
    } catch (error) {
      if ((error as Error).message === "PERMISSION_DENIED") {
        setState(Notification.permission === "denied" ? "denied" : "off");
        toast.error("Permissão de notificação não concedida.");
      } else {
        toast.error((error as Error).message || "Não foi possível ativar as notificações.");
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }
      setState("off");
      toast.success("Notificações desativadas neste aparelho.");
    } catch {
      toast.error("Não foi possível desativar as notificações.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const result = await sendTestPush();
      if (result.sent > 0) toast.success("Notificação de teste enviada.");
      else toast.error("Nenhum aparelho recebeu o teste. Desative e ative de novo.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar o teste.");
    } finally {
      setBusy(false);
    }
  };

  return { state, busy, problems, enable, disable, test };
}

const MESSAGES: Record<Exclude<State, "loading" | "on" | "off">, string> = {
  unsupported: "Este navegador não recebe notificações. Use o Chrome no Android ou o app instalado no iPhone.",
  "needs-install":
    "No iPhone, as notificações só funcionam no app instalado: adicione o painel à Tela de Início (passos abaixo) e ative por dentro do app.",
  "not-configured": "As notificações ainda não foram configuradas no servidor.",
  denied:
    "As notificações foram bloqueadas para este app. Libere em Ajustes do celular → Notificações e volte aqui.",
};

/** Cartão completo, na tela Configurações → App no celular. */
export function PushCard() {
  const { state, busy, problems, enable, disable, test } = usePush();
  const on = state === "on";
  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FDF0F4] text-[#C8285F]">
            {on ? <BellRinging size={26} weight="fill" /> : <BellSlash size={26} />}
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#111827]">Aviso de pedido novo</p>
            <p className="text-sm text-[#6B7280]">
              {state === "loading"
                ? "Verificando este aparelho…"
                : on
                  ? "Ativado: este aparelho avisa quando chegar pedido."
                  : state === "off"
                    ? "Receba uma notificação no celular a cada pedido novo."
                    : MESSAGES[state]}
            </p>
            {state === "not-configured" && problems.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-[#9A3412]">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {state === "off" && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void enable()}
              className="h-10 bg-[#C8285F] px-5 hover:bg-[#A51F50]"
            >
              Ativar notificações
            </Button>
          )}
          {on && (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void test()} className="h-10">
                Enviar teste
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void disable()} className="h-10">
                Desativar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Convite discreto na tela de Pedidos; some quando ativa ou quando é fechado. */
export function PushBanner() {
  const { state, busy, enable } = usePush();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => setDismissed(readDismissed()), []);
  if (dismissed || state !== "off") return null;
  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(BANNER_KEY, "1");
    } catch {
      /* sem armazenamento: volta a aparecer na próxima visita */
    }
  };
  return (
    <div
      role="region"
      aria-label="Notificações de pedido"
      className="flex shrink-0 items-center gap-2 border-b border-[#F3D9E2] bg-[#FDF6F8] py-1.5 pl-4 pr-2 text-xs text-[#7A1F42]"
    >
      <BellRinging size={16} weight="fill" className="shrink-0 text-[#C8285F]" aria-hidden="true" />
      <p className="min-w-0 flex-1">Receba um aviso no celular quando chegar pedido.</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void enable()}
        className="shrink-0 rounded-full bg-[#C8285F] px-3 py-1 text-xs font-semibold text-white hover:bg-[#A51F50] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40"
      >
        Ativar
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Fechar aviso"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#7A1F42]/70 hover:bg-[#FBE7EE] hover:text-[#7A1F42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/40"
      >
        <X size={14} />
      </button>
    </div>
  );
}
