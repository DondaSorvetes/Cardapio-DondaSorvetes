"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { SaveState } from "./SettingsSaveIndicator";

/**
 * Auto-save com debounce, indicador "Salvando..." / "Alterações salvas"
 * e rollback otimista opcional via onError.
 */
export function useAutoSave<T extends object>(options: {
  onSave: (patch: Partial<T>) => Promise<void>;
  debounceMs?: number;
}) {
  const { onSave, debounceMs = 400 } = options;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<T>>({});
  const savingRef = useRef(false);

  const flush = useCallback(async () => {
    const patch = { ...pendingRef.current };
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;

    savingRef.current = true;
    setSaveState("saving");

    try {
      await onSave(patch);
      setSaveState("saved");
      if (hideRef.current) clearTimeout(hideRef.current);
      hideRef.current = setTimeout(() => setSaveState("idle"), 2200);
    } catch (err) {
      console.error("auto-save error:", err);
      setSaveState("error");
      toast.error("Erro ao salvar alterações");
      if (hideRef.current) clearTimeout(hideRef.current);
      hideRef.current = setTimeout(() => setSaveState("idle"), 3000);
    } finally {
      savingRef.current = false;
      // Se chegou patch durante o save, agenda novo flush
      if (Object.keys(pendingRef.current).length > 0) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          void flush();
        }, debounceMs);
      }
    }
  }, [onSave, debounceMs]);

  const queueSave = useCallback(
    (patch: Partial<T>) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      setSaveState((s) => (s === "saving" ? s : "saving"));

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        void flush();
      }, debounceMs);
    },
    [flush, debounceMs]
  );

  /** Save imediato (sem debounce) — switches e ações críticas */
  const saveNow = useCallback(
    async (patch: Partial<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      pendingRef.current = { ...pendingRef.current, ...patch };
      await flush();
    },
    [flush]
  );

  return {
    saveState,
    queueSave,
    saveNow,
    isSaving: saveState === "saving",
  };
}
