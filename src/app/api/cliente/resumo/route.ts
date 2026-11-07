import { obterSessao } from "@/lib/auth";
import { createServerClient } from "@/integrations/supabase/client.server";
import {
  apiOk,
  apiServerError,
  apiUnauthorized,
} from "@/lib/security/api-response";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.apiStrict, checkOrigin: false },
  async (request) => {
    try {
      const session = await obterSessao();
      if (!session) return apiUnauthorized();
      const db = createServerClient();
      const ids = [
        ...new Set(
          (new URL(request.url).searchParams.get("ids") ?? "")
            .split(",")
            .filter((id) => id.length > 0 && id.length <= 100),
        ),
      ].slice(0, 100);
      const [total, active, changes] = await Promise.all([
        db
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", session.id)
          .neq("status", "cancelado"),
        db
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", session.id)
          .not("status", "in", "(entregue,cancelado)"),
        ids.length
          ? db
              .from("pedidos")
              .select("id,status,updated_at")
              .eq("cliente_id", session.id)
              .in("id", ids)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (total.error || active.error || changes.error)
        return apiServerError(total.error || active.error || changes.error);
      return apiOk(
        {
          count: total.count ?? 0,
          ativos: active.count ?? 0,
          updates: changes.data ?? [],
        },
        200,
        { "Cache-Control": "private, no-store", "X-Customer-Id": session.id },
      );
    } catch (error) {
      return apiServerError(error);
    }
  },
);
