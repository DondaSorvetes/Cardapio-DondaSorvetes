"use client";

import { createContext, type ReactNode } from "react";
import type { Category } from "@/data/tipos";
import type { ConfiguracoesLoja } from "@/hooks/useLoja";

export type InitialPublicData = {
  categories?: Category[];
  loja?: ConfiguracoesLoja | null;
  generatedAt: number;
  nextRefreshAt?: number;
};
export const PublicDataContext = createContext<InitialPublicData | null>(null);

/** Public data only: never serialize session, customer data or service credentials. */
export function PublicDataProvider({
  value,
  children,
}: {
  value: InitialPublicData;
  children: ReactNode;
}) {
  return (
    <PublicDataContext.Provider value={value}>
      {children}
    </PublicDataContext.Provider>
  );
}
