import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Cliente Supabase SSR para Server Components e Actions.
 * setAll ignora erros em Server Components (só Actions/Route Handlers
 * podem mutar cookies de verdade — o middleware renova a sessão).
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qbckawrirxsvpgzeakii.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_oeesxJtCBUvmkN4sKeX0xw_z2hO56B1",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components não podem setar cookies — ok ignorar.
          }
        },
      },
    }
  );
}
