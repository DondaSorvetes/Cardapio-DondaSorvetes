import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiOk,
  apiServerError,
  apiUnauthorized,
} from "@/lib/security/api-response";
import { obterSessao } from "@/lib/auth";
import { createServerClient } from "@/integrations/supabase/client.server";
const headers = { "Cache-Control": "private, no-store" };

export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.apiStrict, checkOrigin: false },
  async () => {
    try {
      const sessao = await obterSessao();
      if (!sessao) return apiUnauthorized();
      const { count, error } = await createServerClient()
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", sessao.id)
        .neq("status", "cancelado");
      if (error) return apiServerError(error);
      return apiOk({ count: count ?? 0 }, 200, { ...headers, "X-Customer-Id": sessao.id });
    } catch (error) {
      return apiServerError(error);
    }
  },
);
