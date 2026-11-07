"use client";

import { createContext, createElement, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { imageProxyUrl } from "@/lib/image/proxy-url";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeConfiguracao,
  type ConfiguracaoLoja,
} from "@/types/configuracoes";

export type ConfiguracoesRealtimeStatus = "connecting" | "live" | "error";

function hydrateConfig(raw: Record<string, unknown>): ConfiguracaoLoja {
  const base = normalizeConfiguracao(raw);
  return { ...base, logo_url: imageProxyUrl(base.logo_url), banner_url: imageProxyUrl(base.banner_url) };
}

/**
 * Snapshot + Realtime da tabela `configuracoes_loja`.
 */
function useConfiguracoesSource(
  inicial?: ConfiguracaoLoja | null,
  enabled = true
) {
  const [config, setConfig] = useState<ConfiguracaoLoja | null>(
    () => inicial ?? null
  );
  const [loading, setLoading] = useState(!inicial);
  const [status, setStatus] =
    useState<ConfiguracoesRealtimeStatus>("connecting");

  const supabase = createClient();

  const applyRaw = useCallback(async (raw: Record<string, unknown>) => {
    const hydrated = hydrateConfig(raw);
    setConfig(hydrated);
  }, []);

  const patchConfig = useCallback((patch: Partial<ConfiguracaoLoja>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const replaceConfig = useCallback((next: ConfiguracaoLoja) => {
    setConfig(next);
  }, []);

  // Fetch inicial se não veio do SSR
  useEffect(() => {
    if (!enabled) return;
    if (inicial) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("configuracoes_loja")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (error || !data) {
          setLoading(false);
          return;
        }
        await applyRaw(data as Record<string, unknown>);
      } catch {
        if (!cancelled) setStatus("error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inicial, supabase, applyRaw, enabled]);

  // Realtime
  useEffect(() => {
    if (!enabled) return;
    let channel: RealtimeChannel | null = null;
    // Desktop and mobile sidebars can coexist. Supabase reuses channels by
    // topic, so each effect must own its subscription (including Strict Mode
    // remounts) and remove only that subscription during cleanup.
    const channelName = `admin-configuracoes-loja-${crypto.getRandomValues(new Uint32Array(4)).join("-")}`;

    channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "configuracoes_loja",
        },
        (payload) => {
          const row =
            payload.eventType === "DELETE"
              ? null
              : (payload.new as Record<string, unknown> | null);
          if (row && row.id != null) {
            void applyRaw(row);
          }
        }
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED")
          setStatus("error");
        else setStatus("connecting");
      });

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, applyRaw, enabled]);

  return {
    config,
    loading,
    status,
    patchConfig,
    replaceConfig,
    setConfig,
  };
}

const ConfiguracoesContext = createContext<ReturnType<typeof useConfiguracoesSource> | null>(null);

export function ConfiguracoesLojaProvider({ children }: { children: ReactNode }) {
  const value = useConfiguracoesSource();
  return createElement(ConfiguracoesContext.Provider, { value }, children);
}

export function useConfiguracoesLojaRealtime(inicial?: ConfiguracaoLoja | null) {
  const shared = useContext(ConfiguracoesContext);
  const local = useConfiguracoesSource(inicial, !shared);
  return shared ?? local;
}
