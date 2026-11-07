"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { readPublicJson } from "@/lib/public-json.client";
import { scheduleCatalogRefresh, subscribeCatalogUpdates } from "@/lib/catalog-updates";
import { PublicDataContext } from "@/context/PublicDataContext";
import type { Category, Product } from "@/data/tipos";
import { hasProductPromo } from "@/data/tipos";

type MenuStore = {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  live: boolean;
};

let store: MenuStore = {
  categories: [],
  isLoading: true,
  error: null,
  live: false,
};

const listeners = new Set<() => void>();
let stopUpdates: (() => void) | undefined;
let menuLoad: Promise<void> | null = null;
let reloadMenu = false;
let menuRequest: Promise<Category[]> | null = null;
let menuCacheAt = 0;

function requestMenu() {
  if (!menuRequest) {
    menuRequest = readPublicJson<{ categorias: Category[]; nextRefreshAt?: number }>("/api/cardapio").then(({categorias, nextRefreshAt}) => { scheduleCatalogRefresh(nextRefreshAt); menuCacheAt = Date.now(); return categorias; })
      .finally(() => {
        menuRequest = null;
      });
  }
  return menuRequest;
}

function emit() {
  listeners.forEach((l) => l());
}

function setStore(partial: Partial<MenuStore>) {
  if (Object.entries(partial).every(([key,value]) => store[key as keyof MenuStore] === value)) return;
  store = { ...store, ...partial };
  emit();
}

function loadMenu(): Promise<void> {
  reloadMenu = true;
  if (menuLoad) return menuLoad;
  menuLoad = (async () => {
    do {
      reloadMenu = false;
      try {
        const menu = await requestMenu();
        setStore({ categories: menu, error: null, isLoading: false });
      } catch (err) {
        setStore({ error: err instanceof Error ? err.message : "Não foi possível carregar o cardápio.", isLoading: false });
      }
    } while (reloadMenu);
  })().finally(() => { menuLoad = null; });
  return menuLoad;
}

function ensureMenuLoaded() {
  if (!stopUpdates) stopUpdates = subscribeCatalogUpdates(reason => { if (reason === "initial" && menuCacheAt && Date.now() - menuCacheAt < 30_000) return; void loadMenu(); });
}

/** Keeps the realtime channel through short navigations (e.g. /entrar → /). */
export const MENU_DETACH_MS = 60_000;
let detachTimer: ReturnType<typeof setTimeout> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  clearTimeout(detachTimer);
  detachTimer = undefined;
  ensureMenuLoaded();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    clearTimeout(detachTimer);
    detachTimer = setTimeout(() => {
      detachTimer = undefined;
      if (listeners.size) return;
      stopUpdates?.();
      stopUpdates = undefined;
    }, MENU_DETACH_MS);
  };
}

function getSnapshot() {
  return store;
}

/** Referência estável (exigência do useSyncExternalStore no SSR) */
const SERVER_SNAPSHOT: MenuStore = {
  categories: [],
  isLoading: true,
  error: null,
  live: false,
};

/** Conta produtos com promoção ativa e disponíveis */
export function countPromocoesAtivas(categories: Category[]): number {
  let n = 0;
  for (const c of categories) {
    for (const p of c.products) {
      if (hasProductPromo(p) && p.disponivel !== false) n += 1;
    }
  }
  return n;
}

export function flattenPromoProducts(categories: Category[]): Product[] {
  return categories.flatMap((c) =>
    c.products.filter((p) => hasProductPromo(p) && p.disponivel !== false),
  );
}

/**
 * Cardápio público carregado pelo backend e compartilhado entre as telas.
 */
export function useMenu() {
  const initial = useContext(PublicDataContext);
  const initialSnapshot = useMemo(
    () =>
      initial?.categories
        ? {
            ...SERVER_SNAPSHOT,
            categories: initial.categories,
            isLoading: false,
          }
        : SERVER_SNAPSHOT,
    [initial],
  );
  const primeInitialMenu = useCallback(() => {
    if (initial?.categories && initial.generatedAt > menuCacheAt) {
      menuCacheAt = initial.generatedAt;
      scheduleCatalogRefresh(initial.nextRefreshAt);
      store = {
        ...store,
        categories: initial.categories,
        isLoading: false,
        error: null,
      };
      emit();
    }
  }, [initial]);
  const subscribeWithInitial = useCallback(
    (listener: () => void) => {
      primeInitialMenu();
      return subscribe(listener);
    },
    [primeInitialMenu],
  );

  useEffect(() => {
    primeInitialMenu();
  }, [primeInitialMenu]);

  const snap = useSyncExternalStore(
    subscribeWithInitial,
    getSnapshot,
    () => initialSnapshot,
  );

  const refresh = useCallback(() => loadMenu(), []);

  return {
    categories: snap.categories,
    isLoading: snap.isLoading,
    error: snap.error,
    live: snap.live,
    refresh,
  };
}

/** Quantidade de promoções ativas (para badge na navegação) */
export function usePromocoesCount() {
  const { categories, isLoading } = useMenu();
  return { count: countPromocoesAtivas(categories), isLoading };
}
