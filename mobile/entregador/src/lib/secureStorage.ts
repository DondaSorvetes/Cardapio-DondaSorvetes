import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Armazenamento da sessão do Supabase no SecureStore (Keychain / Keystore).
 * A sessão pode passar de 2 KB, que algumas versões do iOS recusam: o valor é
 * guardado em pedaços ("<chave>.0", "<chave>.1"…) com a quantidade em "<chave>.n".
 */
const CHUNK = 1800;
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
const safe = (key: string) => key.replace(/[^\w.-]/g, "_");

async function removeChunks(key: string) {
  const count = Number((await SecureStore.getItemAsync(`${key}.n`, OPTIONS)) ?? 0);
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`, OPTIONS);
  await SecureStore.deleteItemAsync(`${key}.n`, OPTIONS);
}

/** Versão web (iPhone pelo Safari): não há SecureStore; usa o armazenamento do site. */
const webStorage = {
  async getItem(name: string) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  async setItem(name: string, value: string) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* modo privado/bloqueado: a sessão dura só enquanto a página estiver aberta */
    }
  },
  async removeItem(name: string) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* idem */
    }
  },
};

const nativeStorage = {
  async getItem(name: string): Promise<string | null> {
    const key = safe(name);
    const count = Number((await SecureStore.getItemAsync(`${key}.n`, OPTIONS)) ?? 0);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`, OPTIONS);
      if (part == null) return null; // incompleto: trata como sem sessão
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(name: string, value: string): Promise<void> {
    const key = safe(name);
    await removeChunks(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), OPTIONS);
    await SecureStore.setItemAsync(`${key}.n`, String(count), OPTIONS);
  },
  async removeItem(name: string): Promise<void> {
    await removeChunks(safe(name));
  },
};

export const secureStorage = Platform.OS === "web" ? webStorage : nativeStorage;
