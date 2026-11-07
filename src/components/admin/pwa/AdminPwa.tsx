"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getInstallState,
  startInstallTracking,
  subscribeInstall,
  type InstallState,
} from "@/lib/pwa/install";

const SERVER_STATE: InstallState = { platform: "desktop", standalone: false, canPrompt: false, installed: false };
let snapshot: InstallState = SERVER_STATE;
let snapshotKey = "";

function readSnapshot() {
  const next = getInstallState();
  const key = JSON.stringify(next);
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshot = next;
  }
  return snapshot;
}

/** Estado de instalação do app (mesmo objeto enquanto nada muda). */
export function useInstallState(): InstallState {
  const state = useSyncExternalStore(subscribeInstall, readSnapshot, () => SERVER_STATE);
  // display-mode pode mudar depois da montagem (ex.: abriu pelo ícone).
  const [, rerender] = useState(0);
  useEffect(() => {
    const media = window.matchMedia?.("(display-mode: standalone)");
    const onChange = () => rerender((n) => n + 1);
    media?.addEventListener?.("change", onChange);
    return () => media?.removeEventListener?.("change", onChange);
  }, []);
  return state;
}

/**
 * Registra o service worker do app do painel (só a tela offline; nada de dados em
 * cache) e começa a ouvir o convite de instalação do Android. Fora do app Windows.
 */
export function AdminPwa() {
  useEffect(() => {
    startInstallTracking();
    const desktop = (window as Window & { dondaDesktop?: unknown }).dondaDesktop;
    if (desktop || process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/pwa/admin-sw.js", { scope: "/admin" }).catch(() => {
      // Sem service worker o painel funciona igual; só não instala como app.
    });
  }, []);
  return null;
}
