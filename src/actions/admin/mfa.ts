"use server";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getClientIp, rateLimitCheck } from "@/lib/security/rate-limit";

async function throttle(bucket: string, limit = 10) {
  const incoming = await headers();
  const result = await rateLimitCheck(
    getClientIp(new Request("http://localhost", { headers: incoming })),
    { bucket, limit, windowSec: 60 },
  );
  if (!result.success)
    throw Error("Aguarde um momento antes de tentar novamente.");
}
export async function listAdminMfa() {
  await requireAdmin();
  await throttle("admin:mfa-read", 30);
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw Error("Não foi possível consultar os autenticadores.");
  return data.totp
    .filter((factor) => factor.status === "verified")
    .map((factor) => ({ id: factor.id, friendly_name: factor.friendly_name }));
}
export async function enrollAdminMfa() {
  await requireAdmin();
  await throttle("admin:mfa-enroll");
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Sorvetes Donda ${new Date().toISOString()}`,
    issuer: "Sorvetes Donda",
  });
  if (error)
    throw Error("Não foi possível iniciar a configuração do autenticador.");
  return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}
/** Deliberately permits AAL1: only verifies a factor owned by the signed-in user. */
export async function verifyAdminMfa(factorId: string, code: string) {
  await throttle("admin:mfa-verify");
  if (!/^[0-9a-f-]{36}$/i.test(factorId) || !/^\d{6}$/.test(code))
    return { success: false };
  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) return { success: false };
  if (
    !user.factors?.some(
      (factor) => factor.id === factorId && factor.factor_type === "totp",
    )
  )
    return { success: false };
  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  return { success: !error };
}
export async function unenrollAdminMfa(factorId: string, code?: string) {
  await requireAdmin();
  await throttle("admin:mfa-remove");
  if (!/^[0-9a-f-]{36}$/i.test(factorId)) throw Error("Autenticador inválido.");
  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  const factor = user?.factors?.find(
    (item) => item.id === factorId && item.factor_type === "totp",
  );
  if (userError || !factor) throw Error("Autenticador não encontrado.");
  if (factor.status === "verified") {
    if (!code || !/^\d{6}$/.test(code))
      throw Error("Informe o código atual do autenticador.");
    const verified = await client.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verified.error) throw Error("Código inválido ou expirado.");
  }
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) throw Error("Não foi possível remover o autenticador.");
}
export async function signOutMfaSession() {
  const client = await createServerSupabaseClient();
  await client.auth.signOut();
}
