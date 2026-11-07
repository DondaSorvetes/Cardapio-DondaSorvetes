import { createServerClient } from "@/integrations/supabase/client.server";
import { obterSessao } from "@/lib/auth";
import { apiOk, apiServerError } from "@/lib/security/api-response";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.apiStrict, checkOrigin: false },
  async () => {
    try {
      const sessao = await obterSessao();
      if (!sessao) return apiOk({ count: 0 }, 200, { "Cache-Control": "private, no-store", "X-Customer-Id": "anonymous" });

      const { count, error } = await createServerClient()
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", sessao.id)
        .not("status", "in", "(entregue,cancelado)");
      if (error) throw error;

      return apiOk({ count: count ?? 0 }, 200, { "Cache-Control": "private, no-store", "X-Customer-Id": sessao.id });
    } catch (error) {
      return apiServerError(error);
    }
  }
);
