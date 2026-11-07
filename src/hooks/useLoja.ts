"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { readPublicJson } from "@/lib/public-json.client";
import { subscribeCatalogUpdates } from "@/lib/catalog-updates";
import { PublicDataContext } from "@/context/PublicDataContext";

export type ConfiguracoesLoja = {
  id: number;
  nome: string;
  descricao?: string | null;
  logo_url: string | null;
  banner_url: string | null;
  endereco?: string | null;
  cidade: string | null;
  estado: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  horario_abertura: string | null;
  horario_fechamento?: string | null;
  dias_funcionamento?: string | null;
  taxa_entrega: number;
  pedido_minimo?: number;
  tempo_entrega_min: number | null;
  tempo_entrega_max: number | null;
  esta_aberto: boolean;
  aceitar_pedidos_automaticamente?: boolean;
  aceitando_pedidos?: boolean;
};

type LojaStore = {
  loja: ConfiguracoesLoja | null;
  isLoading: boolean;
  error?: string | null;
};

const SERVER_SNAPSHOT: LojaStore = { loja: null, isLoading: true };
let store = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let stopUpdates: (() => void) | undefined;
let inFlight: Promise<void> | null = null;
let initialAt = 0;
let reloadLoja = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function setStore(partial: Partial<LojaStore>) {
  if (Object.entries(partial).every(([key,value]) => store[key as keyof LojaStore] === value)) return;
  store = { ...store, ...partial };
  emit();
}

async function loadLoja() {
  if (inFlight) {
    reloadLoja = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      const { loja } = await readPublicJson<{ loja: ConfiguracoesLoja | null }>("/api/loja");
      initialAt = Date.now();
      setStore({
        loja,
        isLoading: false,
        error: loja
          ? null
          : "Não foi possível confirmar o funcionamento da loja.",
      });
    } catch {
      setStore({
        isLoading: false,
        error: "Não foi possível consultar a loja. Tente novamente.",
      });
    } finally {
      inFlight = null;
      if (reloadLoja) {
        reloadLoja = false;
        void loadLoja();
      }
    }
  })();
  return inFlight;
}

/** Keeps the realtime channel through short navigations (e.g. /entrar → /). */
const LOJA_DETACH_MS = 60_000;
let detachTimer: ReturnType<typeof setTimeout> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  clearTimeout(detachTimer);
  detachTimer = undefined;
  if (!stopUpdates)
    stopUpdates = subscribeCatalogUpdates(reason => {
      if (reason === "initial" && initialAt && Date.now() - initialAt < 30_000) return;
      void loadLoja();
    });
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    clearTimeout(detachTimer);
    detachTimer = setTimeout(() => {
      detachTimer = undefined;
      if (listeners.size) return;
      stopUpdates?.();
      stopUpdates = undefined;
    }, LOJA_DETACH_MS);
  };
}

export function useLoja() {
  const initial = useContext(PublicDataContext);
  const initialSnapshot = useMemo(
    () =>
      initial?.loja !== undefined
        ? { loja: initial.loja, isLoading: false }
        : SERVER_SNAPSHOT,
    [initial],
  );
  const primeInitialLoja = useCallback(() => {
    if (initial?.loja !== undefined && initial.generatedAt > initialAt) {
      initialAt = initial.generatedAt;
      store = { loja: initial.loja, isLoading: false };
      emit();
    }
  }, [initial]);
  const subscribeWithInitial = useCallback(
    (listener: () => void) => {
      primeInitialLoja();
      return subscribe(listener);
    },
    [primeInitialLoja],
  );

  useEffect(() => {
    primeInitialLoja();
  }, [primeInitialLoja]);

  const snapshot = useSyncExternalStore(
    subscribeWithInitial,
    () => store,
    () => initialSnapshot,
  );
  return {
    loja: snapshot.loja,
    isLoading: snapshot.isLoading,
    error: snapshot.error ?? null,
    refresh: loadLoja,
    live: false,
  };
}
