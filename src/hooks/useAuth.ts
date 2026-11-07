"use client";
import { useAuth as useSharedAuth } from "@/context/AuthContext";
/** Compatibility API backed by the single root provider; never fetch per consumer. */
export function useAuth() {
  const auth = useSharedAuth();
  return {
    cliente: auth.cliente,
    carregando: auth.loading,
    autenticado: Boolean(auth.cliente),
    sair: auth.signOut,
    recarregar: auth.refreshCliente,
  };
}
