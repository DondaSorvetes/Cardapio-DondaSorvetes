import type { SupabaseClient } from "@supabase/supabase-js";
export function revocationEnabled() {
  return process.env.SESSION_REVOCATION_ENABLED === "true";
}
export async function isRevoked(client: SupabaseClient, jti: string) {
  const { data, error } = await client
    .from("sessoes_revogadas")
    .select("jti")
    .eq("jti", jti)
    .maybeSingle();
  if (error) throw new Error("Não foi possível confirmar a sessão.");
  return !!data;
}
export async function revokeSession(
  client: SupabaseClient,
  jti: string,
  exp: number,
) {
  const { error } = await client
    .from("sessoes_revogadas")
    .upsert(
      { jti, expires_at: new Date(exp * 1000).toISOString() },
      { onConflict: "jti" },
    );
  if (error)
    throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
}
