import { createServerClient } from "@/integrations/supabase/client.server";
import { apiOk, apiServerError } from "@/lib/security/api-response";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

import { CAMPOS_DETALHES_LOJA as CAMPOS_DETALHES } from "@/data/loja";

export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.catalogo, checkOrigin: false },
  async () => {
    try {
      const { data, error } = await createServerClient()
        .from("configuracoes_loja")
        .select(CAMPOS_DETALHES)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return apiOk({ detalhes: data ?? null });
    } catch (error) {
      return apiServerError(error);
    }
  }
);
