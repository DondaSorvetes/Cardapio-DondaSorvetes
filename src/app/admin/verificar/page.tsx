import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { adminNeedsMfa } from "@/lib/security/admin-mfa";
import { AdminMfaChallenge } from "@/components/admin/sistema/AdminMfaChallenge";
export default async function VerificarAdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/admin/login");
  if (!(await adminNeedsMfa(supabase, user))) redirect("/admin");
  const factors = (user.factors || [])
    .filter(
      (factor) => factor.status === "verified" && factor.factor_type === "totp",
    )
    .map((factor) => ({
      id: factor.id,
      label: factor.friendly_name || "Aplicativo autenticador",
    }));
  return <AdminMfaChallenge factors={factors} />;
}
