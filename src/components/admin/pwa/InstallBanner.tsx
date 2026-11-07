"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useInstallState } from "./AdminPwa";
import { promptInstall } from "@/lib/pwa/install";

const DISMISS_KEY = "donda:pwa-banner-dismissed";
const DISMISS_DAYS = 30;

/** Convite discreto para instalar o painel, só no celular e só fora do app. */
export function InstallBanner() {
  const state = useInstallState();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setDismissed(Date.now() - at < DISMISS_DAYS * 864e5);
    } catch {
      setDismissed(false);
    }
  }, []);

  const mobile = state.platform === "ios" || state.platform === "android";
  if (dismissed || !mobile || state.standalone || state.installed) return null;
  // No Android o convite só aparece quando o Chrome libera a instalação.
  if (state.platform === "android" && !state.canPrompt) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* sem armazenamento: some só nesta visita */
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-[#E9E3F5] bg-[#F7F4FC] px-4 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático do app */}
      <img src="/pwa/admin-192.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg" />
      <p className="min-w-0 flex-1 text-sm leading-snug text-[#374151]">
        <strong className="font-semibold text-[#111827]">Instale o app Sorvetes Donda</strong> e abra o painel direto pelo
        ícone.
      </p>
      {state.platform === "android" ? (
        <button
          type="button"
          onClick={() => void promptInstall().then((ok) => ok && close())}
          className="shrink-0 rounded-md bg-[#C8285F] px-3 py-1.5 text-sm font-semibold text-white"
        >
          Instalar
        </button>
      ) : (
        <Link
          href="/admin/configuracoes#app"
          className="shrink-0 rounded-md bg-[#C8285F] px-3 py-1.5 text-sm font-semibold text-white"
        >
          Como instalar
        </Link>
      )}
      <button type="button" onClick={close} aria-label="Fechar aviso" className="shrink-0 rounded p-1 text-[#6B7280]">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
