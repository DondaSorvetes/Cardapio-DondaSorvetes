import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { secureStorage } from "./secureStorage";

/*
 * Cliente do Supabase do app do entregador. Só usa a chave PÚBLICA (anon), a
 * mesma do cardápio: tudo que o entregador pode fazer é decidido no banco
 * (funções entregador_* e canal privado). Nunca colocar a service_role aqui.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const configurado = Boolean(url && anonKey);

export const supabase = createClient(url || "https://invalid.supabase.co", anonKey || "invalid", {
  auth: {
    storage: secureStorage,
    storageKey: "donda-entregador-auth",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 2 } },
});

// Renova o token só com o app aberto (economiza bateria e dados em segundo plano).
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
