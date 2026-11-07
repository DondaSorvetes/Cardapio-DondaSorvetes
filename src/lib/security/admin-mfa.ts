import type { SupabaseClient, User } from "@supabase/supabase-js";

type Factors = User["factors"];
export function requiresSecondFactor(factors: Factors, level: string | null) {
  return (
    Boolean(factors?.some((factor) => factor.status === "verified")) &&
    level !== "aal2"
  );
}
export async function adminNeedsMfa(
  client: Pick<SupabaseClient, "auth">,
  user: Pick<User, "factors">,
) {
  if (!user.factors?.some((factor) => factor.status === "verified"))
    return false;
  const { data, error } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return true; // Never bypass an enabled factor when assurance cannot be checked.
  return requiresSecondFactor(user.factors, data.currentLevel);
}
