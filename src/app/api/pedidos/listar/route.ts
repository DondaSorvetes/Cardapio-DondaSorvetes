import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { apiOk, apiServerError } from "@/lib/security/api-response";
import { obterSessao } from "@/lib/auth";
import { createServerClient } from "@/integrations/supabase/client.server";
const headers = { "Cache-Control": "private, no-store" };

export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.apiStrict, checkOrigin: false },
  async (request) => {
    try {
      const sessao = await obterSessao();
      if (!sessao) return apiOk({ pedidos: [], hasMore: false }, 200, { ...headers, "X-Customer-Id": "anonymous" });
      const raw = new URL(request.url).searchParams.get("page") ?? "0";
      const page = /^\d{1,5}$/.test(raw) ? Number(raw) : 0;
      const size = 20;
      const { data, error } = await createServerClient()
        .from("pedidos")
        .select(
          "id, status, created_at, updated_at, total, produto_nome:itens->0->produto->>name, produto_imagem:itens->0->produto->>image",
        )
        .eq("cliente_id", sessao.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * size, page * size + size);
      if (error) return apiServerError(error);
      return apiOk(
        {
          pedidos: (data ?? []).slice(0, size).map(resumirPedido),
          hasMore: (data ?? []).length > size,
        },
        200,
        { ...headers, "X-Customer-Id": sessao.id },
      );
    } catch (error) {
      return apiServerError(error);
    }
  },
);
import { resumirPedido } from "@/lib/customer-order-summary";
